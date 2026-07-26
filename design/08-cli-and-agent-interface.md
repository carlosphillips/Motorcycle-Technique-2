# 08 — CLI & Agent Interface

This document specifies linelab's command-line surface and the programmatic API it
fronts: the verb table, exit-code semantics, the machine-JSON output discipline,
the **zero-file path** (a complete scenario from flags in one command), schema
discoverability, and the eleven agent recipes ((a)–(k), §6). The CLI is the primary
door for AI agents; its design bar is stated first because every choice below
serves it.

Contracts owned elsewhere and consumed here: scenario/plan/road/occluder/hazard/
scene grammars and the mistake compiler with its pin table (**03**); solver
semantics, the merge contract, acceptance policy, believed-road solving, and the
visibility-governed mode (**04**); the result envelope, `resolved_scenario`,
FigureSpec, `stateAt`, version-skew stamps, and export formats (**05**); render
views, modes, and the proportion gate (**06**); the viewer that `serve` launches
(**07**); the acceptance tests behind the design bar (**09** §3.6).

---

## 1. What this document covers

1. The design bar and the discoverability contract.
2. The verb table, exit codes, line selection, gating, compare semantics, and
   output discipline.
3. The zero-file path: the flag set, the composed tokens, precedence, and the
   sweep path grammar.
4. `schema` and `explain` — the self-documentation verbs.
5. The agent recipes ((a)–(k)), end to end.
6. The programmatic API and the closed error vocabulary.
7. Relation to the prior design.
8. Deferred design notes (`--jitter`).

---

## 2. The design bar

> **An agent sets up a NEW scenario correctly on the first try, from `schema` and
> `explain` output alone.**

This is a testable requirement, not a slogan — **09** §3.6 specifies the
*cold-start test* (`T-COLDSTART`): a fresh agent context containing nothing but
the complete printed `schema` output must produce a valid, effectual scenario for
a stated task on its **first non-lint invocation**. During the attempt `schema`,
`explain`, and `check` are freely callable — self-documentation is the designed
path; trial-and-error against the engine is what the bar forbids — and design
docs, examples, and source are not readable. Three rules make the bar reachable:

- **Schema-complete inputs.** Every input surface — scenario JSON, FigureSpec
  JSON, plan actions, road DSL, occluders, hazards, mistake specs, scene text,
  view specs, CLI flags — has a published schema section printed by `schema`. The
  prior design's worst ergonomic hole was an authoring verb whose input shape
  existed only as prose fragments; that class of gap is forbidden here.
- **Schema-valid implies effectual (D8).** Anything accepted does something;
  anything unsupported is rejected at validation with a typed reason. The prior
  design accepted `position` actions and silently ignored them — under D8 that
  exact input is either effectual (it is, per **03**) or exit 2.
- **Errors teach.** Every exit-2 error names the failing field, says why, and
  carries a `schema_ref` naming the schema section that would have prevented it —
  one round trip from mistake to fix.

**Canonical spelling.** FigureSpec JSON (**05** §8.1) is the canonical figure
spelling; scene text and flags are human sugar over it (D30 — `lowerScene` is the
pure, total lowering, and `spec_hash` is computed on the lowered form, so spelling
never changes a figure's identity). The recommended agent door is JSON-in/JSON-out
at both layers.

---

## 3. The verb table

One binary, `linelab <verb>`, a thin IO shell over the pure API (§7). All verbs
that read a scenario accept `--road "<road-ref>"` (the road-ref token of §4.1;
overrides the loaded road at read time, never persisted — carried) and `-` for
stdin. Verbs that address one line of a multi-line envelope share the universal
`--line <id>` selector (§3.3).

| Verb | Syntax (abridged) | Semantics |
|---|---|---|
| `run` | `run [<scenario.json>\|<figure.json>\|-] [zero-file flags] [--gate] [--trace out.csv]` | Compose (file, flags, or both), simulate every line, emit the result envelope. Accepts scenario JSON or FigureSpec JSON. The universal front door: `run` delegates to the solver **iff** the composed input contains any solver-layer field (§3.1), and the envelope records the delegation as `source.kind: "solve"` (**05** §7). |
| `solve` | `solve [<input.json>\|-] [zero-file flags] [--suggest]` | The explicit authoring door (**04**): road + turn-in → co-solved ideal line, self-verified by re-running the engine. `--suggest` reports the feasible turn-in band only. A solved line that misses its applicable bar exits 3 (§3.1); under `--accept best_failing` the best self-verified failure returns instead, with `acceptance.met` recording the miss (**04** §4.7). |
| `mistake` | `mistake <token> --on <solved.json> [--line <baseId>]` | Compile a mistake line off an existing solved line (**03** §7); append it to the envelope. `<token>` is the one composed mistake token (§4.1) — params and scope have exactly one spelling; a supplied `--corners` is `SCHEMA` with the rewrite hint "spell the scope as `@c1,c2` in the token". Base-line selection follows §3.3. Also available as repeatable `--mistake` sugar on `run`/`solve`. |
| `figure` | `figure <file.scene\|figure.json\|-> [--check] [--out dir]` | Bake a figure from either spelling — scene text (**03** §8) or FigureSpec JSON (**05** §8.1), sniffed by content (leading `{` → JSON), never by extension alone — into a multi-line envelope + exported figures. Bakes are declaration-gated by default (§3.1, §3.4) and stamp `engine_semver` + per-line `expected` (**05** §8.4). `--check` lints either spelling without solving. `scene` remains a deprecation-noted alias for one release (same code path; note on stderr, stdout unchanged). |
| `render` | `render <envelope.json> --views topdown,controls,pov [--mode true\|diagram] [--at <s> \| --every <m>] [view flags, §4.1] [--out dir]` | Write SVG files + a manifest. `pov` renders frames at `--at`/`--every` stations. `--mode` selects the top-down projection (**06**); default `diagram`. `--marks`/`--rays`/`--legend`/`--look`/`--orient` override the ViewSpec (§4.2 precedence). |
| `compare` | `compare <A> <B> […] [--lock station\|time] [--out dir]` | Recompute all inputs — anything `run` accepts, plus envelopes (stripped to their FigureSpec and recomputed, per D6) — and emit per-line verdict deltas plus a station-aligned metric diff (sight, speed, lean, grip at shared stations) and an overlay figure. All inputs must resolve to the same road; occluders/hazards may differ and are disclosed in `world_delta` (§3.5). |
| `sweep` | `sweep <base> --param <root-path> --range a:b:step [--param2 …] [--metric list] [--line <id>] [--format tsv\|json]` | Grid-sweep 1–2 root-qualified paths (§4.3) over any composable base — scenario JSON, FigureSpec JSON, `.scene`, stdin, or the full zero-file flag set — holding everything else fixed per the root's recompute rule. One JSON table of closed-vocabulary metrics per cell; capped grid with an explicit `truncated` flag. |
| `check` | `check <scenario.json\|figure.json\|file.scene> [--road …] [--standing]` | Validate only; no simulation. Exit 0 valid / 2 invalid, with `schema_ref`s on every error. Same code path as `figure --check`. `--standing` additionally emits the `StandingReport` for each line under `value.standing[]`. Analysis is not a gate: `--standing` never changes an exit code, the same ruling `state` already carries. |
| `save-window` | `save-window <envelope.json\|-> --line <id> [--corner <id>] [--scan-ds <m>] [--pretty]` | **Inspection tier.** The reserve-lean save window per ran-wide corner (**04** §4b). Exits `0` / `2` / `4` only — no exit-3 tier exists, exactly as for `state`: analysis is not a gate. Out of hash, off by default; `status`, `transition_count` and every scalar are values, never gate signals. |
| `commitment` | `commitment <envelope.json\|-> --line <id> [--prior <name>] [--at <s>\|--at corners]` | **Inspection tier.** The continuation-envelope refutation report (**03** §7a). Exits `0` / `2` / `4` only. Out of hash permanently and off by default; every count and every `escape_status` is a value, not a gate. Rejected `SCHEMA` with `deferred` until D45 is promoted (§7.2). |
| `schema` | `schema [<section>]` | Print the complete input contract as one JSON document (§5.1.1), or one named section (§5.1). |
| `explain` | `explain <envelope.json \| - \| checkId \| errorCode \| mistakeKind> [--line <id>]` | Narrate a result (outcome → diagnosis → per-check evidence → remediation hints), or explain one doctrine check, error code, or mistake kind (§5.2). JSON out, agent-parseable. |
| `state` | `state <envelope.json\|-> --line <id> (--s <m> \| --t <s>)` | Resolve `stateAt` on one line of an envelope; stdout is exactly one `{ok:true, value: InstantState}` document (**05** §4's frozen shape, verbatim). Beyond-domain queries are `BAD_RANGE` carrying the valid `[first, terminated]` interval — never a silent clamp. No exit-3 tier exists for `state`: inspection is not a gate. |
| `serve` | `serve <scenario\|scene\|figure.json\|envelope> [--port N]` | Launch the viewer (**07**) with the payload preloaded; print the URL; run until closed. |
| `export` | `export <envelope.json> --as share-url\|trace-csv\|svg\|envelope\|scenario\|figure-spec [--line <id>\|--all] [--no-cache] [--out …]` | Produce shareable artifacts (**05**): the share string (`#f=` FigureSpec, full line set per D6; `#s=` for a bare single scenario) — always stamped `engine_semver` + per-line `expected` (**05** §8.4), solved-plan cache included by default (`--no-cache` opts out); the per-metre trace CSV (`--line`, or `--all` for one CSV per line, `<figure_id>.<line_id>.csv`); figures; the canonical envelope. `--as scenario --line <id>` emits one line's `resolved_scenario` as a runnable scenario JSON (**05** §7; re-running the exported document reproduces the line, pinned by **09**). `--as figure-spec` emits the canonical FigureSpec of any envelope — the envelope minus computed members, a pure projection. |

### 3.1 Exit codes (one law, five tiers)

Exit codes encode **deviation from declaration, not sim success**. A crash is a
valid, interesting run.

| Exit | Meaning |
|---|---|
| `0` | Ran — physics completed, whatever the fate: gate-less runs exit 0 for ANY outcome of `contained`, `stopped`, `wide`, `runoff`, `crash`. |
| `1` | A write failed (SVG/CSV/manifest); never masks tier 3. |
| `2` | Bad input: schema violation, unknown verb/flag, unparseable DSL, dead field — every typed error of §7.2 except `NO_SOLUTION` and `INTERNAL`. stdout still carries the typed JSON error. |
| `3` | Doctrine/expectation tier: under `--gate` (and by default on `figure` bakes) a line whose observation misses its expectation `E(line)` **in either direction** (§3.4); a `solve` whose line misses the applicable bar — quality `good` under the applicable check set, single corners and chains alike (no chain-specific tier); `NO_SOLUTION` on **every** verb — a valid input the solver refused is the authoring tier, not bad input; figure-level `story`-tier version skew under `--gate` (**05** §8.4); a failed test/gate run per **09**. |
| `4` | `INTERNAL` — an invariant believed impossible. This is also the runtime home of in-flight spec errors; a *refused line* inside a multi-line figure is a `LineRefusal` envelope entry keyed by `line_id` (**05** §7), never a silent drop. |

Delegation never changes tiers: gate-less `run` exits 0 whenever physics ran —
the `solve` verb's authoring bar does **not** ride along on delegation. The
delegation trigger is intensional: *`run` delegates iff the composed input
contains any solver-layer field* — `--turn-in auto`, `--brake auto`, any
`--mistake`, `--style`, the vis mode or its knobs, any `--constraint`,
`--believe-road`, `--accept`. Artifacts still render on exit 3.

### 3.2 Output discipline

- **stdout is exactly one JSON document per invocation** — the envelope, the
  validation report, the schema document (§5.1.1), the sweep table. Nothing else.
  An agent may always `JSON.parse(stdout)`.
- **stderr is for humans**: progress, hints, pretty tables, deprecation notes,
  the gate summary. `--pretty` renders the JSON human-readably (still valid
  JSON); `--quiet` silences stderr.
- Every error is
  `{ok:false, error:{code, at, message, schema_ref?, detail?, deferred?}}` with
  `code` from the closed vocabulary (§7.2) — greppable across a whole agent
  session. `detail` is an optional structured member carrying per-reason fields
  (e.g. `NO_SOLUTION`'s `detail.sub_reason` from **04**'s closed registry, with
  its worst-station/achieved-vs-required payload). `deferred: "<phase>"` rides
  only on `SCHEMA`, under the phase-gating law (**00** §build-phasing): a token
  that exists in the design of record but not in the shipped phase is rejected
  like any unknown token, and `deferred` names when it arrives.

### 3.3 The universal `--line` selector

One selector, one rule, across the surface:

| Operation | `--line` role | Single-line envelope | Multi-line, no `--line` |
|---|---|---|---|
| `state` | line to query | defaults to the sole line | `SCHEMA`/`line_selector_required`, exit 2; the message lists the available `line_id`s |
| `export --as trace-csv` | line to export | sole line | same error (or `--all`: one CSV per line, `<figure_id>.<line_id>.csv`) |
| `run`/`solve` `--trace` | line to trace | sole line | same error |
| `mistake … --on <envelope>` | compile base | sole line | defaults to the **unique** line with role `ideal`; zero or several → same error |
| `export --as scenario` | line to export | sole line | same error |
| `sweep` | default line qualifier for line-scoped roots; metric-column filter | sole line | allowed — columns emitted per line (§4.3) |
| `explain <envelope>` | narrows narration to one line | n/a | allowed — whole-figure narration |

`--line` always selects from an *existing* envelope's lines. It is distinct from
the zero-file flag `--line-id <id>`, which names the primary authored line in a
composed input (§4.1). Generated ids are predictable before the run (§4.1), so
the selector always has something stable to name.

### 3.4 Gating and expectations

`--gate` evaluates every line against its **own expectation**, both directions.
The rule is the pure exported function `gateFigure(envelope) → GateReport`
(§7.1); the per-line expectation `E(line)` derives entirely from the line's spec
— all inputs, all in the envelope's sources, no new computed state:

1. If the line spec carries an explicit `expect` block —
   `expect: { outcome?: [<outcome>…], checks_fail?: [checkId…] }`, a
   FigureSpec-level, shareable input (**05** §8.1) — E is as declared. `expect`
   is **deliberately JSON-only** — no scene key, no flag: gate declarations are
   share/CI metadata on the canonical spelling (D30).
2. Else if `source.kind = "mistake"` → E.outcome = the kind's admissible outcome
   set (**03** §7.1 — the pin table *is* its declaration; no redundant
   `expect_fail`); E.checks_fail = the kind's taught check(s).
3. Else if the solve spec carries `accept: "best_failing"` (**04** §4.7) →
   E = any non-`good` result; the line exists to fail.
4. Else if the line is a chained or `vis: cautious` solve → E.outcome =
   `contained` with the chain-aware applicable check set passing (quality
   `good`).
5. Else (single-corner solve, explicit plan) → E.outcome = `contained`; all
   applicable checks pass/warn/na except the scenario's `expect_fail` entries,
   which **must fail** (the bidirectional rule).

| Line class | Expected outcome | Check expectation | Exits 3 when |
|---|---|---|---|
| solver line, single corner | `contained` (quality `good`) | non-exempt checks pass; `expect_fail` entries fail | outcome ≠ `contained` · a non-exempt check fails · an exempt check passes |
| solver line, chained / vis | `contained` + chain-aware set passes | chain-aware set passes | outcome ≠ `contained` · a chain check fails |
| solver line, `accept: best_failing` | any non-`good` (`acceptance.met` was the input) | none — it exists to fail | quality = `good` (`met: true` under best_failing is itself unexpected) |
| mistake-sourced line | kind's admissible set | kind's taught checks fail | outcome outside the admissible set · a taught check passes |
| explicit-plan line | as row 1 | as row 1 | as row 1 |
| any line with explicit `expect` | as declared | as declared | expectation missed in either direction |

Roles (`ideal`/`alternative`/`mistake`/`reference`) appear nowhere in this table
— they are labels (D9); *sources and declared expectations* drive the gate. A
fig 8.1 figure (clean ideal + `premature` that actually runs off) exits 0 under
`--gate`; it exits 3 precisely when something *unexpected* happened — the
mistake accidentally solved clean, or the good line stopped being clean. That is
a real regression gate for the tool's primary artifact, and it is why `figure`
bakes gate by default: a baked teaching figure carries expectations by
construction.

Output discipline under `--gate`: stdout still carries exactly the envelope; the
exit code is the machine signal; the human summary goes to stderr; and the full
per-line report is recomputable by any consumer via the pure `gateFigure` — no
CLI-only enrichment (§7.1). `explain <envelope>` gains an `expectation` member
per line (met / missed, expected vs observed).

### 3.5 `compare` semantics

- **Inputs:** anything `run` accepts (scenario JSON, zero-file flags, FigureSpec
  JSON, `.scene`) plus envelopes; envelopes are stripped to their FigureSpec and
  **recomputed** (D6 — compare never trusts shipped trajectories).
- **Road rule (typed):** all inputs must resolve to the *same road* — equal
  `fnv1a(canonicalize(resolved road))` (lane width, margins, `use_full_width`,
  segments). A mismatch is `SCHEMA` with reason `road_mismatch`, exit 2, naming
  both road hashes and the first differing segment. `SCHEMA`, not `BAD_RANGE`:
  the shared road is `compare`'s input *contract*; the inputs are individually
  valid but jointly ill-formed.
- **Occluders/hazards may differ** — defined semantics, not an error: comparing
  the same corner with and without a hedge is a legitimate teaching compare. The
  output records a `world_delta` member listing occluder/hazard entries present
  in one input and not the other, so a sight diff across different worlds is
  disclosed, never silent.
- **Pairing:** by `line_id`; unpaired lines are listed under
  `unpaired: {a: […], b: […]}` — reported, never silently dropped.
- **Diff domain:** the intersection of the paired lines' station ranges; the
  output records `span: {from_s, to_s, clipped}` so a shortened diff (early
  termination on one line) is visible.

---

## 4. The zero-file path

The prior design required a file on disk for its authoring door. linelab requires
none: the flag set composes a complete scenario, so one command goes from nothing
to a simulated, judged, rendered scenario.

```
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" \
            --entry 55 --profile street --turn-in auto \
            --mistake premature
```

…composes the road from the DSL, solves the ideal line at 55 km/h with an
auto-placed turn-in, compiles a `premature` mistake line beside it, runs both,
and emits a two-line envelope. Add `--out fig/ --render diagram` to write the
book-style figure in the same breath, or swap `run` for `serve` to open it in the
viewer.

### 4.1 The flag set

**Every schema field is reachable by exactly one documented flag; sugar flags
are marked `sugar` and listed beside their target.** The mapping is itself a
printed schema section — `schema cli`, the cross-surface spelling table (§5.1) —
and the flag table is required bijective with it (**09**, `A-SCHEMA-SHAPE`).
FigureSpec-only members (`expect`, `expected`, `solved`, `engine_semver`) are
the stated exemption: gate declarations and exporter stamps are share/CI
metadata on the canonical JSON spelling (D30), deliberately without flag or
scene-key spellings. Anything expressible by flag is expressible in JSON and
vice versa — flags are sugar, not a second schema.

| Group | Flags |
|---|---|
| Road & world | `--road "<road-ref>"` · `--use-full-width` · `--bike-margin <m>` · `--mu <f>` · `--occluder "<placement-token>"` (repeatable) · `--hazard "<placement-token>"` (repeatable) |
| Rider & start | `--entry <km/h>` · `--start-f <f>` (exposes `rider.start.f`) · `--profile <casual\|street\|trained\|racer>` · `--roll-rate-cap <dps>` (`rider.roll_rate_cap_dps`, **03** §6.1) |
| Plan channels | `--turn-in <auto\|s>` · `--brake <auto\|decel>` · `--brake-slew <m/s³>` · `--throttle <spec>` · `--throttle-slew <m/s³>` · `--throttle-freeze <s>` (the throttle action's `freeze_steer_s`, **03** §6.1) · `--position <spec>` (`over_m` defaults `"auto"`, **03** §6.1) |
| Solver intent (D10) | `--style <single\|double_apex>` · `--vis <none\|cautious>` (sugar: `--visibility-governed`) · `--vis-hold <f>` · `--vis-margin <×>` (**04** §6 — either knob without `--vis cautious` is rejected `INEFFECTUAL`, per D8) · `--constraint "<token>"` (repeatable; the compact bound grammar of **04** §4.5) · `--believe-road "<dsl \| preset name>"` (**04** §4.6) · `--accept <clean\|best_failing>` (**04** §4.7) |
| Lines & mistakes | `--mistake "<mistake-token>"` (repeatable) · `--line-id <id>` |
| View | `--marks "<MarkSpec>"` · `--rays <auto\|off\|all_turn_ins>` · `--legend <auto\|on\|off>` · `--look <heading\|limit_point>` · `--roll <lean\|level>` · `--orient <auto\|0\|90\|180\|270>` (all ViewSpec fields, **06** §2.1; flag-over-file per §4.2). `--roll` (D48) is POV-only: `level` holds the horizon flat and moves lean to the HUD dial. `--s <m>` on `render --views pov` puts the camera at that true station's nearest RECORDED sample (never an interpolated pose) and names the file for it, which is how one figure carries a turn-in, an apex and an exit frame of the same line. |
| Config | `--rubric <pack-id>` (reserved; exactly one legal value today — unknown pack → `SCHEMA`) · `--checks-version <n>` |
| Analysis (out-of-hash, exit-code-neutral) | `--standing` · `--scan-ds <m>` · `--commitment` · `--prior <name>` |

**The analysis flags.** All four are out-of-hash, off by default, absent from
every committed book scene, and exit-code-neutral — they attach or print a
recomputable analysis document and never move a verdict, a colour, a gate or a
hash byte (D29, G7):

```
--standing        boolean, default false.  Emits StandingReport per line (05 §6.4),
                  sited at FigureResult.standing[] — outside lines[].verdict, per 05
                  §7's siting law — and at value.standing[] on check (§3).
                  Out-of-hash; exit-code-neutral; requires the loaded rubric pack to
                  declare annex.reserve_checks (else SCHEMA/reserve_checks_missing).

--scan-ds <m>     save-window scan resolution, default HORIZON_SCAN_DS_M (04 §4b.5).
                  Refused SCHEMA/scan_ds_too_coarse when scan_ds / v_max >
                  HORIZON_TAU_QUANTUM_S over the scan domain (04 §4b.5's resolution
                  law); the error object carries {scan_ds_m, v_max_ms, step_s, bound_s}.
                  It is effectual only on the save-window verb and the viewer's
                  save-window overlay; anywhere else — run, solve, figure — no
                  SaveWindow is emitted, so the flag is rejected INEFFECTUAL with
                  reason scan_ds_without_save_window, per D8.

--commitment      boolean, default false.  On run / solve / figure: attaches the
                  CommitmentReport to each line's verdict (05 §6.5). Out-of-hash,
                  permanently. Deferred until D45 is promoted.

--prior <name>    names the committed continuation pack (default "street").
                  UNKNOWN_ID/unknown_prior when it names no committed pack.
```

`HORIZON_SCAN_DS_M` and `HORIZON_TAU_QUANTUM_S` are declared by **04** §4b.5 and
cited here, never restated; `--prior`'s pack format is **03** §7a.2's.

**Composed tokens.** Three token grammars complete the flag surface; each is
printed by its schema section with worked examples:

```
mistake-token   := [<line_id> "="] <kind> [":" params] ["@" scope]
params          := <key> "=" <value> ("," <key> "=" <value>)*
scope           := <cornerId> ("," <cornerId>)* | "all"

placement-token := <kind> <side> <anchor> <offset>x<span> [<key>=<val> …]   // occluders & hazards
anchor          := "entry:"<id> | "exit:"<id> | "mid:"<id> | "s:"<abs_m>
                 | <id>                                    // bare id = sugar for entry:<id>

road-ref        := "<road DSL>"  |  preset <name> [hand=L|R]
```

- Mistake examples: `premature` · `premature:early_by_m=6` ·
  `chop:offset_m=8,freeze_s=1.5@c2` · `bad2=premature@all`. Token↔JSON is a
  bijection: `--mistake "premature:early_by_m=6@c1,c2"` →
  `{kind: "premature", params: {early_by_m: 6}, scope: ["c1","c2"]}`; `@all` ↔
  `scope: "all_corners"`. This is the ONE mistake grammar across verb, flag, and
  scene (D32) — there is exactly one spelling of params and scope, so nothing
  can conflict. A malformed token is `SCHEMA` with `schema_ref: "cli.mistake"`.
- Placement rules: the anchor **never** carries an offset —
  `SCHEMA`/`anchor_embedded_offset` with the rewrite hint; `<offset>` is a
  station offset (lateral placement is only ever `margin=`). The `vehicle` kind
  takes no span and a separate spaced signed offset:
  `vehicle oncoming exit:c1 +8` (**03** §4.1).
- Road-ref rules: `hand=` with the DSL form is `SCHEMA`/`hand_on_explicit_road`
  ("spell hands per segment"); there is no separate `--hand` flag — the road-ref
  token *is* the flag spelling.

**`--line-id <id>`** names the primary authored line in a composed input
(default `ideal`). Generated ids for `--mistake` sugar lines:
`line_id = <kind>`, or `<kind>@<scope>` when scoped; a remaining collision is
`DUP_ID` with the hint to name lines explicitly via the token's `<line_id>=`
prefix. Ids are thereby predictable before the run.

### 4.2 Precedence and the merge contract

1. Start from the file (or stdin) if given, else from an empty input.
2. Apply flags; **a flag always overrides the corresponding loaded field** (the
   carried `--road` rule, generalized — view flags included).
3. Validate the composed input as if it had been a file — same entry point, same
   errors, same `schema_ref`s. Flag-composed and file-composed scenarios are
   indistinguishable downstream, including in the envelope's recorded input.

Authored plan fields compose with the solver under the merge contract
(**04** §4.6, summarized): a numeric `--brake <decel>` pins the decel control
(that bisection is skipped); a `--throttle` with an onset station pins the
roll-on control, a bare magnitude pins only the magnitude; authored `--position`
actions are carried verbatim into every candidate plan the solver runs; an
explicit `--turn-in <s>` fixes placement while remaining controls solve
normally. **Nothing is ever dropped**: an authored action the solver cannot
honour on any candidate is a typed `NO_SOLUTION` with
`detail.sub_reason: "authored_action_conflict"`, naming the action id. A fully
explicit plan plus a solver-only flag with nothing left to search rejects the
dead flag — `INEFFECTUAL`, e.g. `constraint_without_solver`. Pinned by
`A-MERGE-PIN` (**09**).

### 4.3 The sweep path grammar

`sweep` addresses the whole composed input through a closed root set (D34) —
entry speed, `mu`, solver intent, mistake params, constraint values, beliefs —
never bare array indices:

```
sweep-path := <root-path>
root-path  := "plan."       <actionId> "." <field>     // wire-plan action field
            | "scenario."   ("entry_kmh" | "start_f")  // rider.start scalars
            | "config."     ("mu")                     // numeric config
            | "ride."       <field>                    // solve-spec intent: vis_margin,
                                                       //   vis_hold_f, turn_in_s
            | "mistake."    <lineId> "." <param>       // mistake params (early_by_m,
                                                       //   roll_rate_factor, facets,
                                                       //   offset_m, freeze_s, by_kmh)
            | "constraint." <constraintId> ".value"    // D10 bound values
            | "believe."    ("r_believed" | "sweep_believed_deg")
                                                       // believed-road belief params (04 §4.6)
```

Line scoping: `mistake.` embeds its line id (mistake lines are the added ones);
`plan.`, `ride.`, `constraint.`, and `believe.` resolve against the
`--line`-selected line (default: the sole line / sole solver line; ambiguous →
`SCHEMA`/`line_selector_required`). `scenario.` and `config.` are figure-wide:
on a multi-line base they apply to **every** line — the shared-axis sweep, which
is exactly what the teaching-window question needs.

**Per-root recompute semantics** (what is held fixed — the property a shell loop
over `run` cannot give):

| Root | Per-cell work | Held fixed across cells |
|---|---|---|
| `plan.` | engine run only — the plan is explicit, **the solver is bypassed** (base = the line's `resolved_scenario`, **05** §7) | everything else, all other lines |
| `scenario.`, `config.` | full pipeline (solve + mistake compile) per cell | road, specs, seeds |
| `ride.` | re-solve the addressed line per cell | other lines' solved plans |
| `mistake.` | recompile + run the mistake line per cell | **the base line, solved once** |
| `constraint.` | re-solve per cell; a `NO_SOLUTION` cell is recorded as `outcome: "no_solution"` in that cell — never a verb failure | other lines |
| `believe.` | re-solve the believed world per cell, literalize, execute on the actual road (**04** §4.6) | the actual road, other lines |

**Validation (typed):** unknown root → `SCHEMA`/`sweep_root_unknown`;
nonexistent action/line/constraint id → `UNKNOWN_ID`; non-numeric or
non-sweepable field → `SCHEMA`/`sweep_field_not_numeric`; `step ≤ 0` or inverted
range → `BAD_RANGE`; grid cells > `sweep_max_cells = 2500` (TUNING) → grid
truncated with `truncated: true`. 1–2 `--param`s.

**Metrics (closed vocabulary, printed by `schema sweep`):** `outcome, apex_pct,
apex_f, v_apex_kmh, lean_max_deg, grip_min, exit_f, sight_margin_min_m, end_s,
end_reason, acceptance_met, apex_count, s_divergence_m`. Default
`outcome,apex_pct,grip_min`. Columns are per line, named `<line_id>.<metric>`;
`--line` filters. The per-line apex metrics `apex_pct`, `apex_f`, `v_apex_kmh`
read the **final** entry of the addressed corner's `corners[].apexes[]` list
(**05** §6.3 — the same final-apex rule `late_apex` uses), and are `null` for
any cell whose list is empty; `schema sweep`'s metric rows state this sourcing.

**Output shape (stdout, one JSON document):**

```
{ ok: true, value: { kind: "sweep",
    params:  [ { path, range: {from, to, step} } ],     // 1..2
    metrics: [ … ], lines: [ … ],
    cells:   [ { at: [v1, v2?], per_line: { <line_id>: {<metric>: value…} } } ],
    truncated: false } }
```

`--format tsv|json` (default `json`); `tsv` requires `--out` — stdout stays the
JSON document, the one-document discipline is never broken. Worked sweeps:
recipes (g) and (h) in §6.

---

## 5. Self-documentation: `schema` and `explain`

### 5.1 `schema`

`linelab schema` prints the complete input contract; `linelab schema <section>`
prints one section. Sections (closed list, versioned with the schema):
`scenario`, `plan`, `road-dsl`, `occluders`, `hazards`, `mistakes`, `solve`,
`sweep`, `scene`, `figure`, `view`, `envelope`, `rubric`, `cli`, and — in the
phase that ships it — `continuations`. Content rules that matter for agents:

- **The mistakes section is a teaching table**: each kind carries its parameters
  *and defaults*, its admissible outcome set and single-class fixture pin —
  printed from the same machine-readable pin table **03** §7.1 owns, so the
  schema, the compiler, and the oracle can never disagree — and its book-figure
  mapping (e.g. `premature` → "turned in too soon, runs wide" → Fig 8.1/8.2's
  red line; `premature_contained` → the contained/amber variant).
- **The envelope section documents outputs**, not just inputs — an agent reading
  `schema envelope` learns the Sample fields, the events list, and the verdict
  shape (**05**) without running anything.
- **The solve section carries the intent surface (D10)**: the visibility knobs
  (`vis_hold_f`, `vis_margin`) with defaults and effect, the constraint grammar
  with a worked token example, the strategy selector (`style`), the acceptance
  policy (`accept`), and the believed-road field — the levers an agent uses to
  steer the solver toward custom strategies without a path input ever existing.
- **The cli section is the cross-surface spelling table** (§4.1): rows of
  `{field, scene_key, flag, sugar?}`, e.g.
  `{vis, vis=, --vis, sugar: --visibility-governed}` — one row per wire field,
  bijective with §4.1's flag table.
- **The road-dsl section prints, per preset**: the full expansion *at its
  default hand*, the hand default, the suggested entry, and the book figure it
  matches — mirroring is discoverable before rendering, not after.
- **The sweep section prints** the root set, each root's hold-fixed semantics,
  and the metric vocabulary with its sourcing rules (§4.3).

**The analysis surfaces (D42–D45).** `schema cli` gains the `save-window` and
`commitment` verb rows and their flags. `schema` gains a new `continuations`
section covering the continuation pack format, the `refute_reason` and
`escape_status` closed sets, and the `view.fan` key, with the accompanying
`schema_version` bump; the section is printed only in the phase that ships it,
per the phase-gating law. `schema` also prints the `CounterfactualRider` and
`CfPredicate` closed sets (**04** §4c), the `Standing` closed set (**05** §6.4)
and the `SaveWindow.status` closed set (**04** §4b.5). Under a phase that has not
shipped a token, the token is absent from `schema` and rejected `SCHEMA` with a
`deferred` member — never printed and unimplemented.

#### 5.1.1 The schema document's own shape

The design bar rests on this output, so its shape is pinned like any other
contract:

```
{ ok: true, value: {
    schema_version: <int>,          // bumps on ANY section change
    engine: "linelab/1",
    rubric: "<pack>/<version>",     // the active doctrine pack (05 §6.2)
    checks_version: <int>,          // the independent metric-code version
    sections: { <name>: Section }   // full print: all sections;
} }                                 // `schema <section>`: that one key only

Section     = { name, prose,                // one paragraph, message-style
                fields?:  [Field],          // schema-shaped sections
                kinds?:   [Kind],           // the mistakes teaching table
                grammar?: [GrammarRule],    // token grammars: road-dsl, mistake
                                            //   token, constraint token,
                                            //   placement token, sweep paths
                flags?:   [FlagMapping] }   // cli section only

Field       = { name, type, units?, default?, required?, enum?, effect, schema_ref }
Kind        = { kind, params: [Field], admissible_outcomes, fixture_pin, book_figure, note? }
GrammarRule = { token, form, example }
FlagMapping = { field, scene_key, flag, sugar? }   // the flag↔field bijection, complete
```

Structure for the agent, sentences for the human — the same discipline `explain`
commits to. Every verdict and every `schema` print carry BOTH identities:
`rubric` (the pack, data) and `checks_version` (the metric code); the pack
manifest's `requires_checks_version` is the single source linking them.

### 5.2 `explain`

`explain` closes the loop from output back to understanding:

- given an **envelope** (or `-`): the headline outcome, the diagnosis chain
  (cause → station → corner), every doctrine check with verdict and evidence
  stations — definitions and arithmetic read from the active rubric pack, never
  hard-coded prose — and remediation hints phrased against the closed
  vocabularies, naming fields of the line's `resolved_scenario`
  ("`late_brake` at s=141: brake action b1 ends 9 m past turn-in; move
  `plan.b1.at_s` earlier or reduce `--entry`"). Under `--gate` the narration
  gains an `expectation` member per line (§3.4); `--line` narrows narration to
  one line.
- given a **check id, error code, or mistake kind**: its definition, arithmetic,
  and doctrine source (**01**/**05**). Kind narration is the `schema mistakes`
  teaching-table row for that kind plus its naming note — same data source, no
  duplicated prose. `explain premature` returns the teaching row;
  `explain early_apex` returns the `UNKNOWN_ID`/`renamed_kind` tombstone hint.
  A check id additionally carries a **`rider` block** (D49) — `{title, why,
  fix}` from `plan/doctrine/lexicon.ts`: the check's name in riding words, why
  it matters on a road, and what to do differently. It is presentation only and
  grades nothing; the rubric pack's own `teaches` sentence is unchanged beside
  it, and a lexicon entry can never contradict the catalogue because it reads no
  thresholds.

Disambiguation order, pinned: (1) `-` or an existing readable file → envelope;
(2) else exact match against the closed vocabularies in the order check ids →
error codes → mistake kinds — the three vocabularies are **required disjoint**
(a design-time test asserts no collision; adding a colliding name is a design
error); (3) else `SCHEMA`, message listing all three vocabularies.

`explain` output is JSON with fixed keys; the prose lives in `message` fields, so
an agent can act on the structure and a human can read the sentences.

**Analysis-vocabulary entries (D42–D45).** New entries: `standing`, `reserved`,
`reserve_checks`; `save-window`, `tau_close_s`, `reaction_budget_s`;
`commitment`, `k_refuted`, `k_admissible`, `escape_status`, `filter_effective`;
`counterfactual`, `lean_only_reserve`, `brake_reserve_escape`.

`explain standing` prints the threshold table, the rung-token gloss, the loaded
pack's `reserve_checks`, and the **05** §6.4 placard. `explain save-window`
prints all five `status` values with their sentences and the **04** §4b.7
placard. `explain commitment` prints the refutation-only discipline, the count
grammar, and the **06** §2.7 continuation placard. `explain lean_only_reserve` and
`explain brake_reserve_escape` each print the registry entry and its disclosure
sentence.

These entries are additions to the *analysis* vocabulary, not to the three
disambiguation vocabularies of the pinned order above; §5.2's required-disjoint
test is extended in **09** §3.6 to cover them, so no new name can collide with a
check id, an error code or a mistake kind.

**Tombstones, all `UNKNOWN_ID` with reason `struck_by_decision`**, each naming
its successor mechanism or naming none: `explain out_available` and
`explain sight_ok` name `annex.reserve_checks` (**01** §A.6.1) and check 10
`stop_within_sight` respectively; the flag `--sight-margin-rob` names
`annex.reserve_checks`; `explain commit_within_sight` names **no successor**,
because no refutation-only check is ever promoted. `struck_by_decision` is never
`deferred`: there is no phase in which any of these arrives.

---

## 6. Agent recipes

Eleven canonical end-to-end sequences, (a)–(k). **09** §3.6 extracts each command
block verbatim and executes it as a named acceptance test (`A-RECIPE-A` …
`A-RECIPE-K`; the same roster feeds `T-COLDSTART`'s task battery), so the
recipes cannot rot.

**(a) Ideal line on a small road.**
```
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto
```
Expect: exit 0; envelope with one `ideal` line, outcome `contained` with zero
applicable check fails (the derived *clean*), late apex (the corner's final
`apexes[]` entry in the doctrinal band), and events including `brake_start`,
`turn_in`, `apex`, `release`.

**(b) Ideal + mistake overlay figure.**
```
linelab run  --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto \
             --mistake premature --out out/fig81.json
linelab render out/fig81.json --views topdown --mode diagram --out out/
```
Expect: two-line envelope (green ideal; red `premature` line that runs off per
its **03** §7.1 fixture pin); a compact book-proportioned SVG that passes the
proportion gate (**06**).

**(c) Blind-corner visibility compare.**
```
linelab solve --road "lane 3.5 | S 30 | L 30 ^100 | S 30" --entry 60 --turn-in auto \
              --occluder "hedge inside entry:c1 -25x30 margin=1.0" \
              --out out/geom.json
linelab solve … (same road/occluder) --vis cautious --vis-margin 1.5 --out out/vis.json
linelab compare out/geom.json out/vis.json --lock station
```
Expect: a station-aligned diff and both verdicts; `world_delta` is empty (same
world); the overlay figure shows the hold-wide entry. The visibility-governed
line's distinguishing trait is its **wide commitment**: it carries a vis-hold at
the corner (a held wide `target_f`) that the geometry-optimal line lacks, and it
holds wide **through** the corner — its ridden corridor fraction never diving to
the tight apex the ungoverned line takes — the ratified `adj-vis` hold-wide
mechanism buying the sight standoff through lateral positioning rather than a
lower entry speed (V1's speed governor does not bind on this class of blind
corner; the ungoverned line instead brakes on the approach for its tight-apex
racing line — see DEVIATIONS.md `adj-recipe-c`). `serve` on either envelope
scrubs it (**07** §4.3).

**(d) Linked chain with a per-corner mistake.**
```
linelab run --road "lane 3.5 | S 15 | R 30 ^70 | S 5 | L 25 ^80 | S 20" \
            --entry 55 --turn-in auto --mistake "premature@c1,c2"
```
Expect: a chained ideal line (solved across the linked run by default, **04**
§5) plus a mistake line turned in early at *both* corners, its per-corner
deviation compounding through the sequence — the book's error amplification;
colours per each line's own verdict (D9 — the chained line that is `contained`
with the chain-aware set passing is clean, hence green).

**(e) A named book figure.**
```
linelab figure figures/fig-08-01.scene --out out/
```
where the scene text (**03** §8) names the `book90` road preset (a left-hander,
per its book-ink hand default), an ideal line, a `premature` mistake line, and
an oncoming-vehicle occluder (the wide `premature` line runs toward it — the
book's own danger; `A-FIG81-VEHICLE`). Expect: a figure equivalent to the book's
Fig 8.1 — green delayed-turn line, red `premature` line (the same words the book
prints beside it), hourglass turn-point markers (coincident markers collapse per
**06** §3.1), dashed sight rays to each line's limit point (rays render because
the figure has an occluder, anchored at each line's first `turn_in` — **06**
§3.1), and the
`role · quality (outcome)` legend — in book proportions via the diagram
projection.

**(f) Constraint-shaped custom line.**
```
linelab solve --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto \
              --constraint "f>=0.6@entry:c1..mid:c1"
```
Expect: exit 0 and a solved line whose samples respect the bound over the span,
the verdict's `constraints` block recording each bound's remaining margin and
tightest station; or exit 3 with a typed `NO_SOLUTION` whose
`detail.sub_reason` is `constraint_unmet` (worst station, achieved-vs-required
values).

**(g) The tipping point, end to end.**
```
linelab sweep --road "lane 3.5 | S 12 | R 12 ^90 | S 16" --entry 34 --turn-in auto \
              --mistake chop \
              --param scenario.entry_kmh --range 28:56:2 \
              --metric outcome,end_s --line chop
```
Expect: exit 0; one JSON table; the `chop.outcome` column flips
`contained → wide → runoff → crash` as entry rises; the answer to "at what entry
does chop become crash?" is the boundary between adjacent cells, and
`chop.end_s` shows the departure station marching backwards. The flag-given
`--entry 34` supplies the base value; the swept path overrides it per cell.

**(h) The fig 8.5 teaching window.**
```
linelab sweep figures/fig-08-05.figure.json \
              --param scenario.entry_kmh --range 26:44:1 --metric outcome
```
where the FigureSpec is the lowered shipped `fig-08-05.scene`, declaring two
solver lines — `good` (`style=double_apex`) and `late` (the believed-road
mistake line, **04** §4.6). Expect: per-line outcome columns; the teaching
window is the entry band where `good.outcome` = `contained` (any quality) while
`late.outcome` ∈ {`wide`, `runoff`} — read directly off the table, no shell
loop, base geometry held fixed.

**(i) A believed road: the misjudged corner.**
```
linelab run --road "preset book90" --entry 34 --turn-in auto \
            --mistake "underread:r_believed=16"
```
Expect: exit 0; the solved ideal beside an `underread` misjudge line — its plan
solved clean in the believed world (R 16), literalized, executed on the actual
R 12 (**04** §4.6); samples byte-identical to the believed-world run before
`verdict.misjudgment.s_divergence_m` and wide/runoff after it; the envelope
carries the full believed-vs-actual provenance block (**05** §6.3) and the line
grades a failing class. Pinned as `A-RECIPE-I` on fixture `F-BELIEVED-90`.

**(j) The double apex.**
```
linelab solve --road "preset bookDoubleApex" --entry 30 --style double_apex
```
Expect: exit 0; one green two-touch line — the compound window records exactly
two entries in `corners[].apexes[]` (**05** §6.3; both drawn, addressable as
`apex#1`/`apex#2` in label anchors), quality `good` under the chain/double-apex
applicable check set. The same invocation on `bookDecreasing` refuses with
`NO_SOLUTION`, `detail.sub_reason: "no_two_touch_line"` — or returns the
retained best-failing candidate under `--accept best_failing`. The two-line
fig 8.5 figure adds the believed-road companion of recipe (i)'s mechanism;
recipe (h) sweeps its window. Pinned as `A-RECIPE-J`.

**(k) "Show why holding wide before a blind corner is worth it."** Two solves on
`bookBlind` at 34 km/h — a `vis=none` geometric line and a `vis=cautious`
governed line — then `linelab commitment <envelope> --line <id> --at corners` on
each, and read `k_refuted` off the table at the commitment probe. The governed
line refutes fewer continuations from the same station: the doctrine's payoff as a
count, beside the standing placard. Asserted by `A-RECIPE-K`; a goal-phrased form
joins the `T-COLDSTART` battery. Gated with D45 — until promotion the
`commitment` verb rejects `SCHEMA` with
`deferred: "continuation envelope (D45)"` (§7.2), and the recipe rides with it.

**The recipe's premise is itself gated.** "The governed line refutes fewer
continuations" presumes the V1 governor moves the entry speed on this fixture at
all; on the pre-amendment `bookBlind` it did not (binding needed
`sight_ride_m < 14.53 m` against ≥ 24 m of geometry, so both lines solved to the
same speed). `S-CONT-SEPARATION-v2` step 1 (`09-…md` §3.4a) measures whether it
moves on the reshaped fixture. Until that returns, this recipe's headline
sentence is a hypothesis, and `A-RECIPE-K` must assert the two lines' entry speeds
**differ** before it asserts anything about their counts — otherwise it passes by
equality.

---

## 7. The programmatic API

### 7.1 The CLI is a shell

Every verb is a thin wrapper over importable pure functions — the CLI parses
argv, calls the same function an agent could import, and serializes the Result:

```
import { run, solve, suggestTurnIn, chainedSolve, compileMistake, compare, sweep,
         validate, sightFrom, ssd, stateAt, project, renderViews, explain,
         lowerScene, gateFigure, correctiveShot, counterfactual, standing,
         saveWindow, saveAt, commitmentEnvelope } from "linelab"
```

`counterfactual(world, x0, latency, rider, predicate)` is the one shape all of
this design's what-if questions share (**04** §4c.1). It is pure, takes a
`LineResult` document as its state source, adds no engine run beyond the one it
integrates, and returns a `Result` — a violated rider obligation is `Err`, never
a quiet answer. `correctiveShot`'s shadow, `saveAt` and `E_c` are named thin
wrappers over it, each declaring its `(rider, predicate)` binding at its own
definition site.

`standing(lineResult) → Result<StandingReport>`,
`saveWindow(lineResult, cornerId?) → Result<SaveWindow | SaveWindow[]>`,
`saveAt(line, corner, tau) → Result<{saved, shadow, s_star_m}>`, and
`commitmentEnvelope(lineResult, { prior?, at? }) → Result<CommitmentReport>` are
all at the `correctiveShot` tier: pure, synchronous, frozen in and out,
`Result`-typed, and out-of-hash. `saveWindow`, `standing` and
`commitmentEnvelope` each read a finished result and write nothing back.

**Verb/library equality holds for the new verbs**: `linelab save-window` stdout
byte-equals the library `saveWindow` output, and `linelab commitment`
byte-equals `commitmentEnvelope` — the `A-STATE-VERB` pattern, asserted by
`A-SAVEWIN-VERB` and `A-COMMIT-VERB`. stdout is exactly one JSON document,
`{ok: true, value: …}`; the human summary goes to stderr, precision-clamped
where **04** §4b.5 requires it.

All are pure and synchronous over frozen inputs; **IO lives only in `cli/` and
`viewer/`**. No API function throws across its boundary: fallible operations
return `{ok:true, value} | {ok:false, error}` (Results over exceptions, carried).
The envelope a function returns is the same object the CLI would print — there is
no CLI-only enrichment; `gateFigure` (§3.4) and `lowerScene` (§2) are exported
precisely so any consumer can recompute what the CLI decided. One consumption
rule rides with the surface: the viewer may call `sightFrom` only for
**hypothetical eyes** — positions not on any recorded line (what-if cursor
drags, **07** §2.4); for any instant on a line, the recorded per-sample sight is
authoritative and re-derivation is forbidden (**05** §1). Every name any design
doc requires resolves from the package root (**09**, `A-IMPORT-SURFACE`).

### 7.2 The closed error vocabulary

| Code | Meaning |
|---|---|
| `SCHEMA` | Malformed input / bad field (carries `schema_ref`). Under the phase-gating law (**00** §build-phasing), a designed-but-unshipped token's rejection also carries `deferred: "<phase>"`. |
| `DUP_ID` | Duplicate plan-action / segment / occluder / hazard / line id |
| `OUT_OF_SCOPE` | A deliberate scope cut (low-speed U-turn regime, vertical geometry, moving hazards, …) with the placard text |
| `UNKNOWN_ID` | Addressed an id that does not exist — also the tombstone home: `early_apex` is answered `UNKNOWN_ID`/`renamed_kind` with the hint naming `premature` |
| `BAD_RANGE` | Non-physical number (negative radius, `mu ≤ 0`, …), or an out-of-domain `state` query |
| `NO_SOLUTION` | A solver found no feasible target; the typed sub-reason rides in `detail.sub_reason` (**04**'s closed registry). Exits 3 on every verb. |
| `INEFFECTUAL` | Input that would validate but provably do nothing — rejected, naming the dead field (D8) |
| `INTERNAL` | An invariant believed impossible; exits 4 |

**The `INEFFECTUAL` ruling (D8).** The class covers not only dead fields but
accepted-but-under-delivering inputs, and it wins over `BAD_RANGE` wherever the
value is legal but inert: an unreachable `position` target is
`INEFFECTUAL`/`position_target_unreachable` (with the machine-readable payload
naming `required_over_m`, **03** §6.1); a non-binding rider rate cap is
`INEFFECTUAL`/`roll_rate_cap_not_binding`; a `turn_in` stationed inside a
steering freeze is `INEFFECTUAL`/`turn_in_during_freeze`; a solver-only flag on
a fully pinned plan is `INEFFECTUAL`/`constraint_without_solver`; the visibility
knobs without `--vis cautious` are `INEFFECTUAL` (§4.1). Reason strings ride in
`at`/`detail` — greppable like every other typed rejection.

`NOT_IMPLEMENTED` from the prior vocabulary is retired: a thing is in the schema
and effectual, or it is `OUT_OF_SCOPE`/`SCHEMA` — there is no accepted-but-
unbuilt tier (that tier is what D8 exists to abolish). One future addition is
flagged now so the vocabulary's closedness is not silently broken later:
`NO_FIT` joins this table when the `fit` front door (**04** §deferred) is
promoted, alongside the verb `fit <trace.json> --road <dsl|preset>`.

**Reasons added by D42–D45.** The closed *code* vocabulary above gains no
member; these are named reasons riding in `at`/`detail` under existing codes:

| Code | Reason | Raised when |
|---|---|---|
| `SCHEMA` | `reserve_checks_missing`, `reserve_checks_empty` | rubric pack annex (**01** §A.6.1) |
| `SCHEMA` | `source_unresolved` | a pack `source` string names a book citation that does not resolve (**01** §A.6) |
| `SCHEMA` | `scan_ds_too_coarse` | `--scan-ds` violates the resolution law (**04** §4b.5) |
| `SCHEMA` | `line_selector_required` | multi-line envelope, no `--line`, on `save-window` or `commitment` |
| `SCHEMA` | `pack_defines_rider` | a pack spells a control policy inline (**04** §4c.6) |
| `SCHEMA` | `continuations_version_mismatch` | pack `requires_continuations_version` ≠ the engine's |
| `SCHEMA` | `ladder_cardinality_mismatch` | a continuation pack's `ladder` length ≠ `K_MEMBERS` (**03** §7a.2) |
| `INEFFECTUAL` | `scan_ds_without_save_window` | `--scan-ds` on a verb that emits no `SaveWindow` (§4.1, D8) |
| `UNKNOWN_ID` | `unknown_reserve_check`, `renamed_check` | rubric pack annex members |
| `UNKNOWN_ID` | `unknown_prior` | `--prior` names no committed continuation pack |
| `UNKNOWN_ID` | `unknown_rider` | a pack, config or CLI token names an id outside `CounterfactualRider` (**04** §4c.4, §4c.6) |
| `UNKNOWN_ID` | `struck_by_decision` | `out_available`, `sight_ok`, `SIGHT_MARGIN_ROB`, `commit_within_sight` |
| `UNKNOWN_ID` | (existing) | a bad `--corner` on `save-window` |

**`CfRefusal` never reaches a CLI surface as a typed user error.** A violated
rider obligation (**04** §4c.4) is a design bug, not an input error: any leak
maps to exit-4 `INTERNAL`, consistent with D11's ruling on runtime spec errors.
No `NO_SOLUTION` sub-reason is added by any of D42–D45; none of these functions
solves.

**Phase gating.** Under v0.1 the `save-window` verb, the `--standing` flag and
the viewer overlay reject `SCHEMA` with `deferred: "inspection (v0.2)"`. The
`commitment` verb, `--commitment`, `--prior`, `view.fan` and any token naming
`brake_reserve_escape` reject `SCHEMA` with
`deferred: "continuation envelope (D45)"` until D45 is promoted.

---

## 8. Relation to the prior design

Carried unchanged: the single-binary/single-IO-edge stance; machine JSON on
stdout, humans on stderr; `--road` as a non-persisted override (now the road-ref
token); id-addressed sweep paths (never array indices — carried, now
root-qualified); the closed, greppable error vocabulary; Results over exceptions
end to end.

Changed or new:

- **Schema-complete, with the schema's own shape pinned**: every input surface
  has a printed section; the section list gained `hazards`, `sweep`, `figure`,
  and `rubric`; the wrapper, Section meta-shape, and the bijective `schema cli`
  spelling table are contracts (§5.1.1).
- **The zero-file path**: full scenario composition from flags/stdin; the prior
  design's file requirement is gone, and the flag set is complete — every wire
  field reachable, mechanically asserted (`A-SCHEMA-SHAPE`).
- **`run` as universal front door** with an intensional delegation trigger,
  recorded in the envelope as `source.kind: "solve"` — one verb for an agent to
  remember, with the explicit `solve` retained for authoring-specific control.
- **The `state` verb and the universal `--line` selector** (§3.3): `stateAt` is
  a CLI citizen; every line-addressed operation shares one selection rule with
  typed `line_selector_required` errors.
- **`figure` (né `scene`) and the FigureSpec JSON door** (D30): one verb accepts
  scene text or FigureSpec JSON; `lowerScene` is the pure total lowering;
  `spec_hash` is computed on the lowered form; `--check` lints both spellings.
- **`resolved_scenario` in every `LineResult`** (D29): the run→explain→adjust→
  sweep loop is addressable for solver-authored and mistake-compiled lines;
  `export --as scenario` makes any line a runnable document.
- **Expectation-based gating and five exit tiers** (D33): exit 3 means
  "something unexpected", so `--gate` is usable on figures whose red lines are
  the point; roles never gate (D9); `figure` bakes gate by default; tier 4 is
  `INTERNAL`.
- **One mistake token, one anchor grammar** (D32): `--corners` and the scene
  `scope=` spelling are gone — deprecated spellings are rejected with typed
  rewrite hints, never aliased silently; `early_apex` is a tombstone (D25).
- **Root-qualified `sweep`** (D34): the tipping-point and teaching-window
  questions are one-command answerable, with per-root hold-fixed semantics.
- **`compare`'s input contract made explicit**: one shared road
  (`road_mismatch` typed), disclosed `world_delta`, reported unpaired lines.
- **`export` carries the sharing contract** (D31): stamps (`engine_semver`,
  per-line `expected`) on every share export, the solved-plan cache by default,
  and the full line set per D6 (the prior `url` verb's role is absorbed by
  `export --as share-url`).
- **`explain` narrates whole results, one line, or one vocabulary entry** —
  checks, error codes, and mistake kinds, from the same data the schema prints.
- **`INEFFECTUAL`** added and `NOT_IMPLEMENTED` retired, closing the
  accepted-but-inert input class (D8) that produced the prior design's silently
  dead `position` actions.
- **Authorable solver intent (D10)**: the visibility mode and knobs surface as
  `--vis`/`--vis-hold`/`--vis-margin`, repeatable `--constraint` carries the
  compact bound grammar, `--style`/`--accept`/`--believe-road` complete the
  intent surface, and `schema solve` prints them all — custom strategies become
  flag-expressible without a path input ever existing.
- **The analysis surface (D42–D45)**: the `save-window` and `commitment` verbs
  — both **inspection tier**, no exit-3, exactly as `state` — and the flags
  `--standing`, `--scan-ds`, `--commitment`, `--prior`; the `continuations`
  schema section with its `schema_version` bump; recipe (k); the exported
  `counterfactual`/`standing`/`saveWindow`/`saveAt`/`commitmentEnvelope`
  functions with verb/library equality (`A-SAVEWIN-VERB`, `A-COMMIT-VERB`); the
  new named reasons under existing codes; and the four `struck_by_decision`
  tombstones (`out_available`, `sight_ok`, `SIGHT_MARGIN_ROB`,
  `commit_within_sight`), which name a successor mechanism or none and are never
  `deferred`. Every one of these is out-of-hash, off by default, and absent from
  every committed book scene.

---

## 9. Deferred design notes (non-normative except the layering law)

### 9.1 `--jitter` — the ensemble mode (v2)

Deferred to v2 (**00** §build-phasing); until it ships, `--jitter` tokens reject
`SCHEMA` with `deferred: "ensemble (v2)"` per the phase-gating law. The doctrine
acknowledgment — variability is the doctrine's actual subject — lives in **01**
§6. One law is normative even while the mode is deferred:

> **Randomness never enters `core/`.** The engine remains a pure function of a
> fully-resolved scenario (**09** §3.1 unchanged). An ensemble is N ordinary
> deterministic runs of N recorded scenarios; the RNG that generates the N
> perturbations lives in `cli/` (later `viewer/`), is seeded, and every jittered
> scenario is itself a complete, shareable input. D7 is untouched (every band
> edge is derived from engine-integrated lines, never drawn), and D6 is
> untouched (what is shared is the base spec + `{seed, n, spreads}` — inputs —
> from which any consumer regenerates the identical ensemble).

Sketch (TUNING throughout):

- **Invocation:** `linelab run … --jitter [N]` with `--jitter-seed <uint64>`
  (default `1`) and `--jitter-spread "<param=spread,…>"` overrides. `N` default
  `JITTER_N = 32` (TUNING). `--jitter` composed with `--gate` is rejected
  `SCHEMA` until gating semantics over ensembles are designed.
- **Perturbation set** (closed at v2 launch; uniform draws on `[−1, +1]·spread`):
  entry speed, multiplicative — `JITTER_ENTRY_FRAC = 0.05` (TUNING, ±5 %); `mu`,
  absolute — `JITTER_MU = 0.08` (TUNING), clamped to `(0, mu_max]`; turn-in
  station, absolute — `JITTER_TURNIN_M = 2.0 m` (TUNING, rider placement noise).
- **RNG:** splitmix64. Run `k` (0-based) derives `seed_k = splitmix64(seed ⊕ k)`
  and draws in the fixed order *entry, mu, turn-in* — two independent
  implementations produce byte-identical ensembles.
- **Result:** an `EnsembleResult` per jittered line, appended beside (never
  replacing) the base `LineResult`:

  ```
  EnsembleResult = { base_line_id, seed, n, spreads,
                     runs: [ { deltas: {entry_frac, mu, turn_in_m},
                               outcome, terminated: {reason, s},
                               result_hash } ],          // no trajectories retained
                     outcome_histogram: { contained, stopped, wide, runoff, crash },
                     survival,                            // clean-predicate count / n
                     band: [ { s, d_lo, d_hi, alive } ] } // per retained station
  ```

- **Band rendering:** at each retained station, `d_lo/d_hi` = min/max lateral
  offset over runs still alive there; drawn as one neutral-grey low-opacity
  polygon *beneath* all lines — deliberately **not** verdict-coloured (it is not
  a line; D9 untouched). Terminated runs drop out (the band narrows to
  survivors), and each non-clean run's termination point draws as a small
  neutral mark. The legend carries the histogram: *"27/32 clean · 5/32 runoff"*.
- **Acceptance (pre-written, run at promotion):** `P-JITTER-DETERMINISM`,
  `P-JITTER-PURITY` (the import-graph lint extended: no RNG import beneath
  `cli/`/`viewer/`), and `A-JITTER-LATE-APEX` — the solved late-apex line's
  `survival` is ≥ a contained early-turn-in line's under identical jitter: the
  book's probabilistic late-apex argument, mechanically pinned.

### 9.2 `fit(trace)`

The "grade MY line" front door is **04**'s deferred design note; at promotion
the verb `fit <trace.json> --road <dsl|preset>` enters §3's table and `NO_FIT`
joins §7.2 (flagged there now).
