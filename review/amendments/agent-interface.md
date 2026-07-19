## Agent Interface Completion (cluster: agent-interface)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS:** the `result_hash` formula (verdict minus
>   `{result_hash, diagnosis, cache, skew}` + resolved plan — the exclusion list
>   gains `cache`/`skew` from verification/lifecycle); `resolved_scenario` as
>   output-only provenance; the one composed mistake token (`--corners` and scene
>   `scope=` rejected with rewrite hints — bug-sheet 9.8 subsumed); the one anchor
>   grammar with absolute form `s:<m>` (bug-sheet's `at_s:` respells); the sweep
>   root grammar; 08 §6 recipe lettering ((g)/(h) = the two sweeps; verification's
>   believed-road/double-apex recipes append as (i)/(j) with A-RECIPE-I/J); the
>   `figure` verb rename; the schema wrapper shape; the expectation-based gate
>   frame; roles never gate (misjudgment's `role` gate input dropped).
> - **Exit law merged INTO this section's frame** (one table in 08 §3.1): + tier 4
>   `INTERNAL` (bug-sheet; absorbs the deleted `dnf-spec-error`), + figure/scene
>   default-gated (a baked teaching figure carries expectations by construction),
>   + lifecycle's row "stamped FigureSpec at skew tier `story` → exit 3 under
>   `--gate`", + solver-refit's rider "no chain-specific tier".
> - **Superseded in this section:** outcome vocabulary regenerated from Option B
>   (the `contained` attribution is doctrine-catalogue's, NOT solver-refit's; the
>   old exit-0 list mixing clean/violation/contained is void); `checks_version` is
>   the independent metric-code version (doctrine-catalogue wins); the vehicle
>   occluder wire member re-pins to scene-vocabulary's exclusive union (`verge`
>   lane value deleted; `len_m` spelling); `Kind.outcome_class` replaced by
>   bug-sheet's `{admissible_outcomes, fixture_pin}`.
> - **`expect` vs `expected` (05 §8.1 pins the split):** `expect` = authored,
>   shareable gate declaration (this section's shape; IN spec_hash); `expected` =
>   exporter-written falsifiable stamp `{outcome, result_hash}` (lifecycle's shape,
>   line-level, EXCLUDED from spec_hash); verification's `solved.expected` copy
>   folds into the line-level stamp. Both names kept, each defined once.
> - **Sweep merged:** roots gain `believe.` (r_believed, sweep_believed_deg;
>   re-solve-believed-world-per-cell hold-fixed semantics); `ride.`'s field list
>   gains the misjudge sugar params; the metric vocabulary gains `acceptance_met`,
>   `apex_count`, `s_divergence_m`. Entry speed is `scenario.entry_kmh` everywhere.
> - **Envelope:** `lines: [LineResult | LineRefusal]` with the refusal keyed
>   `line_id` (bug-sheet's `name` respells); error envelope gains optional
>   `detail:{sub_reason,…}` (solver-refit) and the `deferred:"<phase>"` member on
>   SCHEMA (lifecycle).
> - **Wire closure for controller-level mistakes (NEW mechanism, §1):**
>   `slow_steer`'s roll-rate derate and `chop`'s steering freeze gain typed wire
>   homes — `rider.roll_rate_cap_dps` and the throttle action's `freeze_steer_s`
>   (03 §6.1) — so `resolved_scenario` / `export --as scenario` are total over the
>   mistake enum; runwide-physics §3.3's freeze semantics and annotation-grammar
>   §5.2's "rider rate cap" channel now name these fields; `A-RESOLVED-RERUN`
>   names both kinds explicitly.
> - Kinds respelled in place (`premature` nee `early_apex`); `explain premature`
>   returns the teaching row; `explain early_apex` returns the `UNKNOWN_ID/
>   renamed_kind` tombstone hint.

Scope: review §5 (every bullet), §2.5 (`stateAt` verb), §9 items 3/7/9/10 where they
touch the CLI, and the §11 P2 list. Laws honoured throughout: D6 (sharing carries
inputs; every computed member below is explicitly output-provenance), D7 (nothing
here accepts a path), D8 (every deprecated spelling is *rejected with a typed
rewrite hint*, never silently accepted), D9 (roles never enter the gate rule).
Dependencies taken as given (CORRECTED by the merge: the `contained` outcome value
is **doctrine-catalogue's Option B** — solver-refit had declined to mint it; the
merged closed set is `crash|runoff|wide|stopped|contained` with `clean` a derived
predicate and quality words `good|caution|failing`); the doctrine-catalogue
cluster's rubric-pack identity; the misjudgment cluster's
`accept: best_failing` and `bookDoubleApex` preset.

---

### 1. `resolved_scenario` — the resolved plan joins the envelope

**Problem closed** (§5 bullet 1, near-blocker): `explain` says "move `plan.b1.at_s`
earlier", `sweep` addresses `plan.<id>.<field>`, and `stateAt.derived.action` must
return the full resolved PlanAction — but for every solver-authored or
mistake-compiled line the resolved four-action wire plan appears nowhere in the
result. The flagship run→explain→adjust→sweep loop is unactionable.

**Mechanism.** `LineResult` (05 §7) gains one pinned member:

```
LineResult = { line_id, role, label, source,
               resolved_scenario,          // NEW — see below
               trajectory, verdict }

resolved_scenario =                        // the complete post-validation wire
  Scenario (03 §6, canonical form)         // Scenario the engine integrated for
                                           // THIS line: defaults filled, anchors
                                           // and placements resolved to absolute
                                           // stations, the solver/compiler's
                                           // emitted plan actions with their ids
```

Rules:

- **Present on every line regardless of `source.kind`** — for `scenario` sources it
  is the validated normalization of the authored scenario; for `solve` sources it
  carries the canonical four actions the bisections produced; for `mistake` sources
  it carries the base plan with the one perturbation applied. It is self-contained
  (includes the resolved road, occluders, hazards) so that saving it to a file and
  running it is a complete, legal invocation.
- **Provenance: output, never shareable input.** `FigureSpec` (05 §8.1) is
  unchanged — it carries `source` specs only, and every consumer still recomputes.
  D6 is untouched. A sentence is added to 05 §8.1: "`resolved_scenario` is engine
  output; it never rides the share URL and is excluded from `spec_hash`."
- **Hash relationship.** `spec_hash` is unchanged (canonical *source* spec).
  `result_hash` (05 §8.3) is **extended to cover the resolved plan**:
  `result_hash = fnv1a(canonicalize({verdict: V', plan: resolved_scenario.rider.plan}))`
  where `V'` = verdict minus `result_hash`/`diagnosis` as today, and the `plan`
  term carries `rider.roll_rate_cap_dps` beside the actions when present (the
  controller-level compiled surface — wire-closure block below; a drifted derate
  is the same tripwire class as a drifted station). Rationale: a
  solver that converges to a different plan while the rounded verdict happens to
  hold is a behavioural change the regression tripwire must catch. This is a hash
  semantics change and lands through 09 §3.3's re-bless procedure (one commit, all
  fixtures regenerated). *(User decision 1 if the owner prefers the weaker
  verdict-only hash.)*
- **Addressing.** Three consumers are now defined against it, stated in their
  owning sections: `stateAt.derived.action` = the PlanAction in
  `resolved_scenario.rider.plan` whose `id` equals the sample's `action_id`
  (05 §4); `explain`'s remediation hints name fields of `resolved_scenario`
  (08 §5.2); `sweep`'s `plan.` root addresses `resolved_scenario.rider.plan`
  (§3 below).
- **Export door:** `export --as scenario --line <id>` emits one line's
  `resolved_scenario` as a runnable scenario JSON. Acceptance test A-RESOLVED-RERUN
  (§14) pins the honesty property: re-running the exported document reproduces the
  line's trajectory tolerance-equal.

**Controller-level mistake surfaces — the wire-closure rule (NEW; closes the
fig-8.2 schema gap).** "Saving it to a file and running it is a complete, legal
invocation" is only true if every compiled perturbation is *spellable* in the wire
Scenario, and two kinds were not: `slow_steer` derates the rider's roll-rate cap
(`roll_rate × roll_rate_factor`, 03 §7.1) and `chop` freezes steering for
`freeze_s` — controller-level perturbations with no schema field behind them (the
cut's slew rides the throttle action; the derate and the freeze rode only the
mistake spec). 03 §6/§6.1 gain two typed fields; the compiler emits them; the
engine honours them on any scenario:

```
rider.roll_rate_cap_dps?: number      // effective steering-rate cap. The controller reads
                                      //   roll_rate_eff = min(profile.roll_rate_dps, cap)
                                      //   everywhere it reads the profile rate: commit ramp,
                                      //   heading-capture release accrual, unwind, tracker
                                      //   cap (P-ROLLRATE reads roll_rate_eff), d_flip link
                                      //   budget, lean-aware ssd stand-up phase.
                                      //   Validation: cap ≤ 0 → BAD_RANGE; cap ≥ profile
                                      //   rate → INEFFECTUAL/roll_rate_cap_not_binding (D8 —
                                      //   a non-binding cap is a dead field). slow_steer
                                      //   compiles to cap = roll_rate_factor · profile rate
                                      //   (street default 0.3 · 50 = 15 °/s).

PlanAction(throttle).freeze_steer_s?: number
                                      // steering freeze from this action's onset station:
                                      //   roll_cmd = 0 for freeze_steer_s seconds —
                                      //   semantics verbatim runwide-physics §3.3 (rider
                                      //   yields; phi evolves under phi_dot_su alone;
                                      //   selects the c = 0 widening column). Range
                                      //   (0, FREEZE_MAX_S = 5.0 s] (TUNING), else
                                      //   BAD_RANGE; SCHEMA on any other action kind. A
                                      //   turn_in stationed inside a freeze window is
                                      //   INEFFECTUAL/turn_in_during_freeze (it would be
                                      //   accepted-but-ignored). chop compiles its cut with
                                      //   freeze_steer_s = freeze_s; the corrective's
                                      //   t_freeze_end (corrective-offroad §1.3) reads the
                                      //   resolved window, so an exported chop line
                                      //   corrects identically.
```

Spellings complete the surfaces (the A-SCHEMA-SHAPE flag↔field bijection stays
true): flags `--roll-rate-cap <dps>` and `--throttle-freeze <s>` join 08 §4.1;
scene `rollRateCap=` (ride-line option, beside `startF=`) and `freeze=` (throttle
action, beside `slew=`); both fields get `verify/effectuality.json` witness rows
as a matter of course. **The closure rule, stated normatively (one sentence into
03 §7.1):** *a mistake kind may compile only to surfaces the wire Scenario can
spell; minting a kind whose perturbation has no schema home is a design error* —
A-RESOLVED-RERUN (§14) is its mechanical form. (Considered and rejected: carrying
the resolved `mistakeSpec` inside `resolved_scenario` with compile-on-load
semantics — it would make the member pre-compilation for exactly the lines the
loop most needs, dangle `sweep`'s `plan.` addressing and `stateAt.derived.action`,
and tie an exported file's behaviour to the consumer's compiler version — the
drift class `result_hash` exists to catch.)

**Placement:** 05 §7 (member + rules; replaces the current three-member LineResult
block), 05 §8.1 (provenance sentence), 05 §8.3 (hash formula — replaces
"`result_hash` = fnv-1a over the canonical verdict with `result_hash` and
`diagnosis` removed"), 08 §5.2 + §6 (addressing), 08 verb table `export` row,
03 §6/§6.1 + §7.1 and 02 §3 (the wire-closure fields, their validation, the
closure sentence, and the `roll_rate_eff` read), 08 §4.1 (the two new flags).

---

### 2. The `state` verb and the universal `--line` selector

**Problem closed** (§2.5, blocker): 05 §4 promises `stateAt` "exposed identically…
as a CLI verb (08)"; 08 has no such verb, no line-selector convention, no exit
mapping.

**Verb-table row (08 §3):**

| Verb | Syntax | Semantics |
|---|---|---|
| `state` | `state <envelope.json\|-> --line <id> (--s <m> \| --t <s>)` | Resolve `stateAt` on one line of an envelope; stdout = exactly one `{ok:true, value: InstantState}` document (05 §4's frozen shape, verbatim). |

Exit codes: `0` success; `2` for every typed input error — `SCHEMA` when both or
neither of `--s`/`--t` are given, when `--line` is missing on a multi-line envelope
(reason `line_selector_required`, message lists the available `line_id`s), or
`UNKNOWN_ID` for a nonexistent line; `BAD_RANGE` (exit 2) for out-of-domain
queries, with `at` carrying the valid `[first, terminated]` interval per 05 §4. No
exit-3 tier exists for `state` — inspection is not a gate. 05 §4's cross-reference
sentence is updated to name the verb spelling `state`.

**The universal `--line <id>` convention (new subsection 08 §3.3).** One selector,
one rule, across the surface:

| Operation | `--line` role | Single-line envelope | Multi-line, no `--line` |
|---|---|---|---|
| `state` | line to query | defaults to the sole line | `SCHEMA line_selector_required`, exit 2 |
| `export --as trace-csv` | line to export | sole line | same error (or `--all`: one CSV per line, `<figure_id>.<line_id>.csv`) |
| `run`/`solve` `--trace` | line to trace | sole line | same error |
| `mistake … --on <envelope>` | compile base | sole line | defaults to the **unique** line with role `ideal`; zero or several → same error |
| `export --as scenario` | line to export | sole line | same error |
| `sweep` | default line qualifier for line-scoped roots; metric-column filter | sole line | allowed — columns emitted per line (§3) |
| `explain <envelope>` | narrows narration to one line | n/a | allowed — whole-figure narration |

`--line` always selects from an *existing* envelope's lines. It is distinct from
the zero-file flag `--line-id <id>`, which is finally defined (08 §4.1): it names
the primary authored line in a composed input (default `ideal`). Generated ids for
`--mistake` sugar lines: `line_id = <kind>`, or `<kind>@<scope>` when scoped; a
remaining collision is `DUP_ID` with the hint to name lines explicitly via the
token's `<line_id>=` prefix (§5). Ids are thereby predictable before the run —
the selector always has something stable to name.

**Placement:** 08 §3 (row), new 08 §3.3, 08 §4.1 (`--line-id` definition replaces
the bare listing), 05 §4 (verb name cross-ref).

---

### 3. `sweep` generalized: one root-qualified path grammar

**Problem closed** (§5 bullet 2): entry speed, `mu`, `vis_margin`, mistake params,
constraint values — every axis an author actually wants — are outside
`plan.<id>.<field>`. The tipping-point question is unanswerable, and the fig 8.5
teaching window (misjudgment cluster dependency) cannot be found.

**Path grammar (closed root set; replaces "`--param plan.<id>.<field>`" in the
verb row):**

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
```

Line scoping: `mistake.` embeds its line id (mistake lines are the added ones);
`plan.`, `ride.`, and `constraint.` resolve against the `--line`-selected line
(default: the sole line / sole solver line; ambiguous → `SCHEMA
line_selector_required`). `scenario.` and `config.` are figure-wide: on a
multi-line base they apply to **every** line — the shared-axis sweep, which is
exactly what the teaching-window question needs.

**Per-root recompute semantics** (what is held fixed — the property a shell loop
over `run` cannot give):

| Root | Per-cell work | Held fixed across cells |
|---|---|---|
| `plan.` | engine run only — the plan is explicit, **the solver is bypassed** (base = the line's `resolved_scenario`, §1) | everything else, all other lines |
| `scenario.`, `config.` | full pipeline (solve + mistake compile) per cell | road, specs, seeds |
| `ride.` | re-solve the addressed line per cell | other lines' solved plans |
| `mistake.` | recompile + run the mistake line per cell | **the base line, solved once** |
| `constraint.` | re-solve per cell; a `NO_SOLUTION` cell is recorded as `outcome: "no_solution"` in that cell — never a verb failure | other lines |

**Validation (typed):** unknown root → `SCHEMA sweep_root_unknown`; nonexistent
action/line/constraint id → `UNKNOWN_ID`; non-numeric or non-sweepable field →
`SCHEMA sweep_field_not_numeric`; `step ≤ 0` or inverted range → `BAD_RANGE`;
grid cells > `sweep_max_cells = 2500` (TUNING) → grid truncated with
`truncated: true` (carried flag, value now pinned). 1–2 `--param`s as today.

**Base composition:** `sweep` accepts everything `run` accepts — scenario JSON,
FigureSpec JSON, `.scene`, stdin, **plus the full zero-file flag set** — so the
swept base can be composed inline; the verb row's `<scenario>` argument is
generalized accordingly.

**Metrics (closed vocabulary, printed by the new `schema sweep` section):**
`outcome, apex_pct, apex_f, v_apex_kmh, lean_max_deg, grip_min, exit_f,
sight_margin_min_m, end_s, end_reason`. Default `outcome,apex_pct,grip_min`.
Columns are per line, named `<line_id>.<metric>`; `--line` filters. Normative
re-keying onto the reshaped verdict (misjudgment cluster's `corners[]` lists):
the per-line apex metrics `apex_pct`, `apex_f`, `v_apex_kmh` read the **final**
entry of the addressed corner's `corners[].apexes[]` list (the same final-apex
rule `late_apex` and the best_failing `apex_pct_final` ranking use), and are
`null` for any cell whose list is empty — no accepted apex before termination.
`schema sweep`'s metric rows state this sourcing.

**Output shape (stdout, one JSON document):**

```
{ ok: true, value: { kind: "sweep",
    params:  [ { path, range: {from, to, step} } ],     // 1..2
    metrics: [ … ], lines: [ … ],
    cells:   [ { at: [v1, v2?], per_line: { <line_id>: {<metric>: value…} } } ],
    truncated: false } }
```

`--format tsv|json` (default `json`); `tsv` requires `--out` (stdout stays the
JSON document — the one-document discipline is never broken).

**Recipe (g) — the tipping point, end to end** (08 §6, new):

```
linelab sweep --road "lane 3.5 | S 12 | R 12 ^90 | S 16" --entry 34 --turn-in auto \
              --mistake chop \
              --param scenario.entry_kmh --range 28:56:2 \
              --metric outcome,end_s --line chop
```

Expect: exit 0; one JSON table; the `chop.outcome` column flips
`clean → wide → runoff → crash` as entry rises; the answer to "at what entry does
chop become crash?" is the boundary between adjacent cells, and `chop.end_s` shows
the departure station marching backwards. The flag-given `--entry 34` supplies the
base value; the swept path overrides it per cell.

**Recipe (h) — the fig 8.5 teaching window** (08 §6, new; the sweep the
misjudgment cluster depends on):

```
linelab sweep figures/fig-08-05.figure.json \
              --param scenario.entry_kmh --range 26:44:1 --metric outcome
```

where the FigureSpec is the lowered shipped `fig-08-05.scene` (the misjudgment
cluster's §6.1 definition site), declaring two solver lines — `good`
(`style=double_apex`) and `late` (the believed-road mistake line, misjudgment
cluster). Expect: per-line outcome columns; the teaching window is the entry band
where `good.outcome` = `contained` (any quality) while `late.outcome` ∈
{wide, runoff} — read directly off the table, no shell loop, base geometry held
fixed.

**Placement:** 08 §3 `sweep` row rewritten; new 08 §4.3 "The sweep path grammar";
§5.1's section list gains `sweep`; recipes (g)/(h) in §6; 08 §1 "Five canonical
agent recipes" → "Ten" — the count is letter-derived from the final §6 roster
(a)–(j), this section's banner having appended verification's (i)/(j) (also fixes
§9 item 10's count drift; a future recipe letter moves this word again, so the 08
edit should cite the roster, not hard-code the numeral elsewhere).

---

### 4. The FigureSpec JSON door

**Problem closed** (§5 bullet 3): FigureSpec is the canonical share payload yet no
verb accepts it; everything multi-line is authorable only as whitespace-significant
scene text — a third spelling of every field. Files are free; grammars are
expensive.

**Mechanism.**

- The figure verb becomes `figure <file.scene | figure.json | -> [--check] [--out dir]`
  — it accepts **either** scene text **or** FigureSpec JSON, sniffed by content
  (leading `{` → JSON), never by extension alone. `scene` remains as an alias verb
  for one release (same code path; a deprecation note on stderr — stdout
  unchanged). `run` also accepts FigureSpec JSON wherever it accepts a scenario
  (the envelope is the same shape either way).
- **Canonical lowering.** `lowerScene(sceneText) → Result<FigureSpec>` is a pure,
  total, deterministic function (exported, §7.1). Scene text is hereby *redefined
  as sugar over FigureSpec*, exactly as flags are sugar over the scenario schema —
  the layering claim "flags are sugar, not a second schema" finally holds one
  layer up.
- **Round-trip guarantee (normative):** baking a scene and baking its lowered
  FigureSpec produce byte-identical envelopes, and `spec_hash` is computed on the
  lowered FigureSpec in both cases — a figure's identity is spelling-independent.
  Pinned by A-FIGURE-JSON-PARITY (§14).
- **The loop closes:** `export --as figure-spec` emits the canonical FigureSpec of
  any envelope (it is the envelope minus computed members — pure projection).
- **Canonical spelling in docs, stated in 08 §2 and 03 §8:** *FigureSpec JSON is
  the canonical figure spelling from now on; scene text and flags are human sugar.
  The recommended agent door is JSON-in/JSON-out at both layers.* Design docs
  express figure examples as FigureSpec first, scene text as the sugar exhibit.
- `--check` lints both spellings without solving (carried behaviour, now covering
  JSON); `check <file>` is stated to be the same code path as `figure --check`.

**Placement:** 08 §3 (`scene` row → `figure` row + alias note), 08 §2 (canonical-
spelling statement), 04 §7 (opening paragraph gains the lowering + sugar
redefinition; the scene format's contents are otherwise untouched), 05 §8.1
(cross-ref: the share payload is loadable by `figure`), §5.1 section list gains
`figure`.

---

### 5. One composed mistake-spec grammar

**Problem closed** (§5 catch-all; §9 item 8's `--mistake` half): three spellings —
verb `mistake <kind[:k=v,…]> --on … [--corners c1,c2]`, sugar
`--mistake "premature@c1,c2"`, scene `mistake premature early_by_m=6
scope=all_corners` — with no composed grammar or precedence.

**The one grammar (canonical mistake token; printed by `schema mistakes` and
`schema cli`):**

```
mistake-token := [<line_id> "="] <kind> [":" params] ["@" scope]
params        := <key> "=" <value> ("," <key> "=" <value>)*
scope         := <cornerId> ("," <cornerId>)* | "all"
```

Examples: `premature` · `premature:early_by_m=6` ·
`chop:offset_m=8,freeze_s=1.5@c2` · `bad2=premature@all`.

Mapping of the three surfaces onto it:

| Surface | Form | Fate of the old spelling |
|---|---|---|
| verb | `mistake <token> --on <envelope> [--line <baseId>]` | `--corners` is **removed**; scope is spelled only inside the token. A supplied `--corners` is `SCHEMA` with the rewrite hint ("spell the scope as `@c1,c2` in the token"). |
| flag sugar | `--mistake "<token>"` (repeatable) | unchanged shape, grammar now complete (params + scope compose; `@all` is spellable). |
| scene | `bad: mistake <token>` — the entry name supplies `line_id`, so the `<line_id>=` prefix is `SCHEMA` there | the space-separated `key=val … scope=…` spelling is **rejected** with a typed `SCHEMA` error whose message prints the equivalent token (deprecate-with-rewrite-hint; per D8 nothing is silently accepted or ignored). |
| JSON wire | `{kind, params?, scope?}` unchanged (03 §7.2) | token↔JSON is a bijection: `@all` ↔ `scope: "all_corners"`, corner list ↔ array. |

Precedence questions dissolve: there is exactly one spelling of params and scope,
so nothing can conflict. Base-line selection for `--on` follows the universal
selector (§2): sole line, else unique `ideal`, else typed error — the scene
layer's first-`ride`-line rule and the CLI now state the same rule.

**Placement:** 08 §3 (`mistake` row), 08 §4.1 (sugar grammar with a worked
parameterized example), 04 §7 (scene `mistake` line kind — replaces
"`mistake <kind> [key=val …] [scope=…]`"), 03 §7.2 (token↔JSON bijection note).
Pinned by A-MISTAKE-GRAMMAR (§14).

---

### 6. Pinned wire JSON shapes: occluder, hazard, road segment

**Problem closed** (§5 catch-all; §9 item 3): the wire schema points at 03 §4,
which defines only scene tokens; the occluder ref token has three mutually
incompatible committed shapes.

**The ref-token resolution (one form, others mapped):** the occluder/hazard anchor
reuses the plan-action anchor grammar of 03 §6.1 verbatim — one anchor grammar in
the whole design. Scene/CLI token form:

```
placement-token := <kind> <side> <anchor> <offset>x<span> [<key>=<val> …]
anchor          := "entry:"<cornerId> | "exit:"<cornerId> | "mid:"<cornerId>
                 | "s:"<abs_m> | <cornerId>          // bare id = sugar for entry:<id>
offset          := signed decimal (m, along the road from the anchor)
span            := strictly positive decimal (m)
```

- Bare `c1` (03's presets, 04's example) is **legal sugar** for `entry:c1` — the
  presets stand as written.
- `entry|exit|mid:<id>` (03's grammar) is the canonical anchor.
- 08 recipe (c)'s `entry:c1-25 -1.0x30` is **declared erroneous and corrected**:
  an offset never rides inside the anchor token (`SCHEMA
  anchor_embedded_offset`, with the rewrite hint). The recipe is rewritten
  `--occluder "hedge inside entry:c1 -25x30 margin=1.0"` (the stray `-1.0` was a
  margin).

**Occluder wire shape (new 03 §4.1):**

```
Occluder = { id: string,                       // minted o1, o2… if absent; DUP_ID on collision
             kind: "hedge"|"wall"|"bank"|"vehicle",
             side: "inside"|"outside"|"left"|"right",
             at:   { ref: "entry|exit|mid:<cornerId>", offset_m?: number }
                 | { at_s: number },
             span_m: number,                   // band kinds; vehicle: ignored → SCHEMA if present
             margin_m?: number, depth_m?: number,      // hedge/wall/bank (defaults per 03 §4)
             len_m?: number, width_m?: number,         // vehicle (defaults 4.5, 1.8;
                                               // `len_m` spelling — scene-vocabulary wins)
             lane?: "own"|"oncoming",                  // vehicle only. MERGED (scene-vocabulary
                                               // owns semantics): EXACTLY ONE of lane ⊕ f ⊕
                                               // side(+margin_m); the "verge" lane value is
                                               // deleted — verge placement is the side form;
                                               // typed reasons vehicle_lane_xor_side,
                                               // vehicle_span_not_allowed, margin_requires_side,
                                               // lane_requires_vehicle.
                                               // "own"/"oncoming" place the footprint ON the
                                               // carriageway — the fig 8.1 oncoming vehicle.
                                               // Semantics owned by the roads/visibility
                                               // cluster (review §8.6); the field is pinned
                                               // here so the wire shape is closed.
           }
```

**Hazard wire shape (new 03 §4.2):**

```
Hazard = { id: string, kind: "gravel",
           side: "inside"|"outside"|"left"|"right"|"center",
           at: <same anchor object>, span_m: number,
           width_m?: number,                   // default 1.4
           mu: number }                        // default 0.4; 0 < mu, BAD_RANGE otherwise
```

Lateral semantics pinned: the μ-override band occupies `width_m` of lateral extent
flush against the named usable edge (`inside`/`outside`, hand-resolved through
`sideSign`), or centred on `f = 0.5` for `center`.

**Road segment wire shape (new 03 §2.1):**

```
Segment = { type: "straight", len_m }
        | { type: "arc",   r_m,        angle_deg, hand: "L"|"R" }
        | { type: "taper", r1_m, r2_m, angle_deg, hand: "L"|"R" }
```

and the wire `road` object additionally accepts `{ dsl: "<road-DSL line>" }` as a
third alternative beside `segments` and `preset` — agents never hand-expand
segments. Canonical resolved form (what `resolved_scenario` and the envelope
carry): `{ lane_width_m, bike_margin_m, use_full_width, segments: […], dsl }` —
the originating DSL string rides along verbatim (the disclosure rule 03 §3.1
already requires for presets, generalized).

**Envelope impact:** `FigureResult` (05 §7) gains `occluders: [Occluder]` and
`hazards: [Hazard]` in resolved absolute form beside `road` — compare and any
diff consumer can locate a patch without re-deriving placements (closes the
cold-start compare finding's third leg).

**Placement:** 03 §2 (segment shape), new 03 §4.1/§4.2 (wire shapes + token
grammar, replacing the prose-only "Placement grammar" paragraph), 03 §6 (road
`dsl` alternative), 05 §7 (envelope members), 08 §6 recipe (c) (corrected token).

---

### 7. Hazards get a flag and a schema section

**Problem closed** (§5 catch-all): the word "hazard" does not occur in 08; the
claim "every field an authoring input can carry has a flag" is falsified.

- 08 §4.1 gains `--hazard "<placement-token>"` (repeatable), same token grammar as
  `--occluder` (§6); families are distinguished by `kind`.
- §5.1's closed section list gains `hazards` (and, from §3–§4 above, `sweep` and
  `figure`, plus the doctrine-catalogue cluster's `rubric` — its §8 placement
  row): full list now `scenario, plan, road-dsl, occluders, hazards,
  mistakes, solve, sweep, scene, figure, view, envelope, rubric, cli`.
- 08 §2's input-surface enumeration adds "hazards" between occluders and mistake
  specs.
- Completing the same falsified claim: 08 §4.1 also gains `--use-full-width` and
  `--bike-margin <m>` (road options that exist in the wire schema with no flag;
  the fig 8.4 cluster needs `--use-full-width` reachable). D8 effectuality tests
  cover all three as a matter of course (09 §8).

---

### 8. `--gate` over intended-fail lines: expectation-based gating

**Problem closed** (§5 bullet 4; §9 item 7; fig 8.4's exit-3): as written, every
good-vs-mistake figure exits 3 and `--gate` is useless in CI for the tool's
primary artifact.

**Mechanism — every line gates against its own expectation.** Define, as a pure
exported function `gateFigure(envelope) → GateReport`, the per-line expectation
`E(line)`, derived entirely from the line's spec (all inputs, all in the
envelope's sources — no new computed state):

1. If the line spec carries an explicit `expect` block (NEW, FigureSpec-level,
   input, shareable):
   `expect: { outcome?: [<outcomeClass>…], checks_fail?: [checkId…] }` — E is as
   declared. (This is also the hook the share-URL cluster's per-line
   `expected:` stamp composes with.) `expect` is **deliberately JSON-only** —
   no scene-text key, no flag: gate declarations are share/CI metadata on the
   canonical spelling (D30 — scene text is authoring sugar, not an expectation
   surface), sitting beside the exporter-written `expected`/`solved` members of
   the same FigureSpec surface. Bug-sheet 9.8's "every schema field is
   reachable by exactly one documented flag" claim scopes to the
   *scenario-schema* surface; FigureSpec-only members (`expect`, `expected`,
   `solved`, `engine_semver`) are its stated exemption, so `A-SCHEMA-SHAPE`'s
   cli-table bijection is unaffected.
2. Else if `source.kind = "mistake"` → E.outcome = the kind's pinned outcome
   class set (03 §7.1); E.checks_fail = the kind's taught check(s) (the oracle's
   `expect_fail`).
3. Else if the solve spec carries `accept: "best_failing"` (misjudgment cluster)
   → E.outcome = any non-clean class; the line exists to fail.
4. Else if the line is a chained or `vis=cautious` solve → E.outcome =
   `contained` and the chain-aware applicable check set passes (quality `good`
   via solver-refit's applicability machinery under Option B).
5. Else (single-corner solve, explicit plan) → E.outcome = `contained`; all applicable checks
   pass/warn/na except the scenario's `expect_fail` entries, which **must fail**
   (the oracle's bidirectional rule, applied at the CLI).

**The gate table (line class × observation → contributes exit 3?):**

| Line class | Expected outcome | Check expectation | Exits 3 when |
|---|---|---|---|
| solver line, single corner | `contained` (quality `good`) | non-exempt checks pass; `expect_fail` entries fail | outcome ≠ contained · a non-exempt check fails · an exempt check passes |
| solver line, chained / vis | `contained` + chain-aware set passes | chain-aware set passes | outcome ≠ contained · a chain check fails |
| solver line, `accept: best_failing` | any non-good (acceptance.met the input) | none — it exists to fail | quality = `good` (met:true under best_failing is itself unexpected) |
| mistake-sourced line | kind's pinned class | kind's taught checks fail | outcome outside the pinned class · a taught check passes |
| explicit-plan line | as row 1 | as row 1 | as row 1 |
| any line with explicit `expect` | as declared | as declared | expectation missed in either direction |

Roles (`ideal`/`alternative`/`mistake`/`reference`) appear nowhere in this table —
they are labels (D9); *sources and declared expectations* drive the gate. A
fig 8.1 figure (clean ideal + `premature` that actually runs off) now exits 0
under `--gate`; it exits 3 precisely when something *unexpected* happened — the
mistake accidentally solved clean, or the good line stopped being clean. That is
a real regression gate for the tool's primary artifact. Fig 8.4's red companion
(a `best_failing` strategy line) gates on being non-clean, so the two-strategy
figure also exits 0.

**Output discipline:** with `--gate`, stdout still carries exactly the envelope;
the exit code is the machine signal, the human summary goes to stderr, and the
full per-line report is recomputable by any consumer via the pure `gateFigure`
(no CLI-only enrichment, 08 §7.1 honoured). `explain <envelope>` gains an
`expectation` member per line (met / missed, expected vs observed).

**Exit-tier updates (08 §3.1, rewritten rows):**

- Exit 0 row's outcome list is REGENERATED from the merged closed set (Option B):
  gate-less `run` exits 0 whenever physics ran, i.e. for ANY outcome of
  "`contained`, `stopped`, `wide`, `runoff`, `crash`" (`clean`/`violation` are no
  longer outcome words; the old mixed list is void).
- **`NO_SOLUTION` exits 3 on every verb** — a valid input the solver refused is
  the doctrine/authoring tier, not bad input; `run` and `solve` no longer differ.
  (Closes the cold-start delegation-exit ambiguity: gate-less `run` exits 0
  whenever physics ran, whatever the outcome; the solve verb's authoring bar does
  **not** ride along on delegation.)
- `solve`'s exit-3 rule is restated against the bar, not the word "clean":
  *exit 3 iff the solved line misses its applicable bar* — quality `good` under
  the applicable check set, single corners and chains alike (no chain-specific
  tier; resolving §4's
  three-way contradiction on the CLI side; outcome vocabulary itself is the
  solver-refit cluster's).
- Delegation is recorded as `LineResult.source.kind = "solve"` — stated in both
  08 §3 and 05 §7 (the "says so in the envelope" claim finally has a pinned
  field). The delegation trigger becomes intensional: *`run` delegates iff the
  composed input contains any solver-layer field* — `turn-in auto`, `brake auto`,
  any `--mistake`, `style=`, vis mode/knobs, any constraint.

**Placement:** 08 §3.1 (tier table), new 08 §3.4 "Gating and expectations"
(the table + `gateFigure`), 05 §8.1 (FigureSpec `lines[]` entries gain optional
`expect`, declared JSON-only by design — the sentence above lands there
verbatim), 03 §6 (`expect_fail` sentence gains the bidirectional note), 08 §7.1
(export `gateFigure`).

---

### 9. `compare`: the shared-road presumption made explicit

**Problem closed** (§5 catch-all): `compare` silently presumes one shared road;
a naive implementation diffs station 40 of road A against station 40 of road B.

- **Inputs:** anything `run` accepts (scenario JSON, zero-file flags, FigureSpec,
  `.scene`) plus envelopes; envelopes are stripped to their FigureSpec and
  **recomputed** (D6 — compare never trusts shipped trajectories).
- **Road rule (typed error — the pick):** all inputs must resolve to the *same
  road*: equal `fnv1a(canonicalize(resolved road))` (lane width, margins,
  `use_full_width`, segments). A mismatch is `SCHEMA` with reason `road_mismatch`,
  exit 2, naming both road hashes and the first differing segment. Rationale for
  SCHEMA over BAD_RANGE: the shared road is `compare`'s input *contract*; the
  inputs are individually valid but jointly ill-formed.
- **Occluders/hazards may differ** — defined semantics, not an error: comparing
  the same corner with and without a hedge is a legitimate teaching compare. The
  output records a `world_delta` member listing occluder/hazard entries present
  in one input and not the other, so a sight diff across different worlds is
  disclosed, never silent.
- **Pairing:** by `line_id`; unpaired lines are listed under
  `unpaired: {a: […], b: […]}` — reported, never silently dropped.
- **Diff domain:** the intersection of the paired lines' station ranges;
  the output records `span: {from_s, to_s, clipped}` so a shortened diff (early
  termination on one line) is visible.

**Placement:** 08 §3 `compare` row rewritten with the above; the details in a new
08 §3.5.

---

### 10. Authored plan + `--turn-in auto`: the merge contract

**Problem closed** (§5 catch-all): flags let an agent pass `--position`,
`--brake 3.0`, `--throttle …` alongside `--turn-in auto`, and no merge rule
exists — the solver either silently drops authored actions (the exact class D8
abolishes, on the exact field whose prior silent death motivated D8) or does
something unspecified.

**Merge contract (new 04 §4.6; summarized in 08 §4.2):**

- An authored **numeric `--brake <decel>` pins the decel control**: the solver
  skips the decel bisection and uses the authored value (taper placement per
  `brake_gap` unchanged). `--brake auto` bisects as today.
- An authored **`--throttle` with an onset station pins the roll-on control**
  (exit bisection skipped); a bare magnitude pins only the magnitude, onset still
  bisected.
- Authored **`--position` actions are carried verbatim into every candidate plan**
  the solver runs — present in the coarse sweep, both bisections, and the
  self-verify run. Hold-wide authoring composes with `auto` by construction.
- An authored **explicit `--turn-in <s>`** fixes placement; remaining controls
  solve normally.
- **Nothing is ever dropped.** An authored action the solver cannot honour on any
  candidate (e.g. a `position` window that overlaps the turn-in commitment at
  every feasible placement) is a typed `NO_SOLUTION`, sub-reason
  `authored_action_conflict`, naming the action id.
- A **fully explicit plan plus a solver-only flag** with nothing left to search
  rejects the dead flag: `INEFFECTUAL`, e.g. `constraint_without_solver` for
  `--constraint` on a fully pinned plan (adopting the cold-start fix; `--constraint`
  joins the delegation trigger list per §8 above).

Pinned by A-MERGE-PIN (§14).

---

### 11. `explain <kind>` accepted

**Problem closed** (§5 catch-all): 01 §4.3 and 03 §7.1 require `explain(kind)`;
08's verb accepts only envelope | checkId | errorCode.

Verb signature becomes: `explain <envelope.json | - | checkId | errorCode |
mistakeKind>`. Disambiguation order, pinned: (1) `-` or an existing readable file
→ envelope; (2) else exact match against the closed vocabularies in the order
check ids → error codes → mistake kinds — the three vocabularies are **required
disjoint** (a design-time test asserts no collision; adding a colliding name is a
design error); (3) else `SCHEMA`, message listing all three vocabularies. Kind
narration content = the `schema mistakes` teaching-table row for that kind plus
the naming-trap note — same data source, no duplicated prose.

**Placement:** 08 §3 (`explain` row), 08 §5.2 (input set + disambiguation).

---

### 12. The `schema` verb's own output pinned

**Problem closed** (§9 item 9): "exactly one JSON document" yet "schema text
(wrapped)" — the design bar rests on an output whose shape is the one contract
never pinned.

**Top-level shape (new 08 §5.1.1):**

```
{ ok: true, value: {
    schema_version: <int>,          // bumps on ANY section change
    engine: "linelab/1",
    rubric: "<pack>/<version>",     // the active doctrine pack (§13)
    sections: { <name>: Section }   // full print: all sections;
} }                                 // `schema <section>`: that one key only

Section = { name, prose,                    // one paragraph, message-style
            fields?:  [Field],              // schema-shaped sections
            kinds?:   [Kind],               // the mistakes teaching table
            grammar?: [GrammarRule],        // token grammars: road-dsl, mistake
                                            //   token, constraint token,
                                            //   placement token, sweep paths
            flags?:   [FlagMapping] }       // cli section only

Field       = { name, type, units?, default?, required?, enum?, effect, schema_ref }
Kind        = { kind, params: [Field], admissible_outcomes, fixture_pin, book_figure, note? }   // merged: bug-sheet 9.9's pair replaces outcome_class so `schema mistakes` prints the one normative pin table (ORACLE-PIN-TABLE reads the same source)
GrammarRule = { token, form, example }
FlagMapping = { flag, field, section }      // the flag↔field bijection, complete
```

Structure for the agent, sentences for the human — the same discipline `explain`
already commits to. The `cli` section's `flags` table is required **bijective**
with 08 §4.1 (asserted by A-SCHEMA-SHAPE, §14). 08 §3.2's "the schema text
(wrapped)" is replaced by a reference to this shape.

---

### 13. `checks_version` sourcing — dependency on the doctrine-catalogue cluster

**Stated dependency (not resolved here):** the doctrine-catalogue cluster makes
the check suite a named pack (`rubric: "parks-street/2"`, review §8.2). This
cluster requires only, and 08/05 will say only:

- every verdict and every `schema` print carry BOTH identities — `rubric`
  ("<pack>/<version>", data) AND `checks_version` (the independent metric-code
  version; MERGED: doctrine-catalogue wins — the "derived from the pack version"
  sentence is dropped; the pack manifest's `requires_checks_version` is the single
  source linking them);
- `explain <checkId>` reads definition and arithmetic from the pack, not from
  hard-coded prose;
- the flag namespace reserves `--rubric <pack-id>` for if/when packs become
  selectable (unknown pack → `SCHEMA`).

Exact field spellings in 03 §6 `config` and 05 §6.2 are the doctrine cluster's to
pin; this section's schema wrapper (§12) and gate mechanics (§8) are
rubric-agnostic by construction.

---

### 14. Acceptance tests handed to 09 (the verification cluster writes them)

**Problem closed** (§5 last bullet): 08 twice delegates the cold-start test and
per-recipe acceptance tests to 09; 09 contains neither. The reconciled bar
statement (08 §2 is edited to match): the cold-start context is **the literal
full `schema` print plus the `explain` outputs for the closed vocabularies** —
"schema + explain output alone" wins over "nothing but schema".

The list (names are the shared surface; one-line assertions here, mechanics in
09):

- **T-COLDSTART** (verification's 09 §6.1 spelling — that cluster owns the test;
  the `T-` prefix marks the record-gated pair with `T-COLDSTART-RECORD`) —
  harness: context as above; battery = recipes (a)–(h) plus one
  novel-scenario task per input surface (road-dsl, plan, occluder, hazard,
  mistake, constraint, figure); pass = correct exit tier on the first command
  sequence per task.
- **A-RECIPE-A … A-RECIPE-F** — the six existing recipes as named fixtures with
  expected exit codes and envelope assertions (a: clean ideal, doctrinal apex
  band; b: two-line overlay, mistake outcome matches pin; c: vis compare with the
  corrected occluder token, station-aligned diff present; d: chained mistake at
  both corners; e: fig 8.1 scene bake passes the proportion gate; f: constraint
  margins recorded / typed `constraint_unmet`).
- **A-RECIPE-G** — the tipping-point sweep (§3): outcome column exhibits the
  monotone flip; `truncated: false`; solver bypassed for `plan.` roots (assert
  identical base `spec_hash` across cells).
- **A-RECIPE-H** — the fig 8.5 entry-window sweep: per-line columns; a non-empty
  window where `good.outcome` = `contained` and `late.outcome` ∈ {wide, runoff}
  (the shipped `fig-08-05.scene` roster).
  *(Depends on the misjudgment cluster's `accept: best_failing` and
  `bookDoubleApex`.)*
- **A-STATE-VERB** — `state` on a two-line envelope: missing `--line` exits 2
  listing line ids; a valid query's stdout equals the library `stateAt` result
  byte-for-byte; beyond-termination query is `BAD_RANGE` with the interval.
- **A-RESOLVED-RERUN** — `export --as scenario --line <id>`, re-run the document,
  trajectory tolerance-equal to the original line — per mistake kind, explicitly
  including the two controller-level kinds: `slow_steer` (the exported document
  carries `rider.roll_rate_cap_dps = 15` on the street fixture) and `chop` (the
  exported throttle-cut action carries `slew_mss` + `freeze_steer_s`) — extends
  09 §4's round-trip.
- **A-FIGURE-JSON-PARITY** — scene text vs `lowerScene` output: byte-identical
  envelopes, equal `spec_hash`.
- **A-MISTAKE-GRAMMAR** — one parameterized scoped token through verb, sugar, and
  scene lowers to the identical MistakeSpec JSON; legacy `scope=` spelling and
  `--corners` are rejected with rewrite hints.
- **A-GATE-FIGURE** — recipe (b)'s figure under `--gate` exits 0; a fixture whose
  mistake line solves clean exits 3; a `best_failing` line that comes out clean
  exits 3; roles permuted → gate result unchanged (D9).
- **A-SWEEP-ROOTS** — every root in §3's closed set observably changes the
  addressed value per cell; unknown root / non-numeric field / bad range produce
  their named typed errors; the `sweep_max_cells` cap sets `truncated`.
- **A-COMPARE-ROADS** — differing roads → `SCHEMA road_mismatch` exit 2; same
  road, differing occluders → success with `world_delta` populated; unpaired
  lines listed.
- **A-MERGE-PIN** — authored `--brake 3.0` with `--turn-in auto`: emitted plan's
  decel equals 3.0 (bisection skipped); authored `--position` present in the
  final plan and in every self-verified candidate; impossible position →
  `NO_SOLUTION authored_action_conflict`.
- **A-EXPLAIN-KIND** — `explain premature` returns the teaching-table row + the
  naming-trap note; the three explain vocabularies are disjoint.
- **A-SCHEMA-SHAPE** — full `schema` output parses; every section validates
  against the Section meta-shape; the cli flag table is bijective with 08 §4.1
  (this is the mechanical form of "every field has a flag" — it would have caught
  the hazards hole).
- **A-HAZARD-FLAG** — `--hazard` changes per-sample `mu` on a reference scenario
  (D8 effectuality); same for `--use-full-width` and `--bike-margin`.
- **Open slots for other clusters' recipes** — the harness enumerates recipes
  from 08 §6 by letter, so recipes added by the misjudgment (believed-road),
  doctrine (rubric), and chain clusters join T-COLDSTART's battery by appending,
  not by editing this list.

**Placement:** new 09 §3.6 "CLI and cold-start acceptance" holding T-COLDSTART +
the A-RECIPE-* table; the remaining A-* distribute into 09 §3.4/§3.5/§4/§8 per
their subject; 08 §2 and §6 update their delegation sentences to name 09 §3.6.

---

### 15. Decision drafts (editor numbers them)

- **Draft: "The envelope records the resolved scenario."** Every `LineResult`
  carries `resolved_scenario` — the post-validation wire scenario the engine
  integrated, solver and compiler output included. It is output provenance:
  excluded from `FigureSpec` and `spec_hash` (D6 untouched), covered by
  `result_hash`. Rationale: the run→explain→adjust→sweep loop must be actionable
  for solver-authored lines; a result you cannot address is not inspectable.
- **Draft: "FigureSpec JSON is the canonical figure spelling; scene text is
  sugar."** One verb accepts both; a pure total lowering defines scene text;
  spelling never changes a figure's identity (`spec_hash` computed on the lowered
  form). Rationale: for agents, files are free and grammars are expensive; the
  canonical share payload must be loadable everywhere it is emitted.
- **Draft: "One mistake token, one anchor grammar."** Mistake specs have exactly
  one composed token grammar across verb, flag, and scene; occluders, hazards,
  and plan actions share the single anchor grammar. Deprecated spellings are
  rejected with typed rewrite hints, never aliased silently (D8).
- **Draft: "Expectation-based gating."** `--gate` evaluates each line against its
  own declared or derived expectation (kind pins, chain bar, `best_failing`,
  explicit `expect`), bidirectionally; roles never gate (D9). Exit 3 means
  "something unexpected", making the gate usable on figures whose red lines are
  the point.
- **Draft: "Root-qualified sweep paths."** `sweep` addresses the whole composed
  input through a closed root set with per-root hold-fixed semantics, making the
  tipping-point and teaching-window questions one-command answerable.

### 16. User decisions

1. **`result_hash` coverage** — include the resolved plan in `result_hash`
   (catches silent solver drift; forces one re-bless) vs keep verdict-only
   (weaker tripwire, no migration). *Recommendation: include; the re-bless is one
   commit and the drift class is real.*
2. **Verb naming** — rename `scene` → `figure` with `scene` as a deprecation-
   noted alias vs keep `scene` accepting JSON. *Recommendation: rename; the verb
   now primarily takes FigureSpec JSON and the old name would mislabel the
   canonical door.*
3. **`--corners` fate** — remove outright (recommended; pre-1.0, no compat debt,
   one spelling) vs keep as alias with a conflict error when `@` is present.
4. **`state` beyond-the-end queries** — pinned here as `BAD_RANGE` exit 2 per
   05 §4's no-silent-clamp rule; if the owner wants viewer-style clamping at the
   CLI, it must be an explicit `--clamp` flag, never a default.
   *Recommendation: keep the typed error; add `--clamp` only if a real workflow
   demands it.*
