# 08 — CLI & Agent Interface

This document specifies linelab's command-line surface and the programmatic API it
fronts: the verb table, exit-code semantics, the machine-JSON output discipline,
the **zero-file path** (a complete scenario from flags in one command), schema
discoverability, and five canonical agent recipes. The CLI is the primary door for
AI agents; its design bar is stated first because every choice below serves it.

Contracts owned elsewhere and consumed here: scenario/plan/road/occluder/scene
grammars and the mistake compiler (**03**); solver semantics and the
visibility-governed mode (**04**); the result envelope, `stateAt`, and export
formats (**05**); render views, modes, and the proportion gate (**06**); the
viewer that `serve` launches (**07**); the acceptance tests behind the design bar
(**09**).

---

## 1. What this document covers

1. The design bar and the discoverability contract.
2. The verb table, exit codes, and output discipline.
3. The zero-file path and its precedence rules.
4. `schema` and `explain` — the self-documentation verbs.
5. Five agent recipes, end to end.
6. The programmatic API and the closed error vocabulary.
7. Relation to the prior design.

---

## 2. The design bar

> **An agent sets up a NEW scenario correctly on the first try, from `schema` and
> `explain` output alone.**

This is a testable requirement, not a slogan — **09** specifies the *cold-start
test*: an agent context containing nothing but the printed `schema` output must
produce a valid, effectual scenario for a stated task. Three rules make the bar
reachable:

- **Schema-complete inputs.** Every input surface — scenario JSON, plan actions,
  road DSL, occluders, mistake specs, scene text, view specs, CLI flags — has a
  published schema section printed by `schema`. The prior design's worst
  ergonomic hole was an authoring verb whose input shape existed only as prose
  fragments; that class of gap is forbidden here.
- **Schema-valid implies effectual (D8).** Anything accepted does something;
  anything unsupported is rejected at validation with a typed reason. The prior
  design accepted `position` actions and silently ignored them — under D8 that
  exact input is either effectual (it is, per **03**) or exit 2.
- **Errors teach.** Every exit-2 error names the failing field, says why, and
  carries a `schema_ref` naming the schema section that would have prevented it —
  one round trip from mistake to fix.

---

## 3. The verb table

One binary, `linelab <verb>`, a thin IO shell over the pure API (§7). All verbs
that read a scenario accept `--road "<dsl>"` (overrides the loaded road at read
time, never persisted — carried) and `-` for stdin.

| Verb | Syntax (abridged) | Semantics |
|---|---|---|
| `run` | `run [<scenario.json>\|-] [zero-file flags] [--gate] [--trace out.csv]` | Compose (file, flags, or both), simulate every line, emit the result envelope. The universal front door: if the composed input needs solving (`--turn-in auto`, any `--mistake`, `--visibility-governed`), `run` delegates to the solver internally and says so in the envelope. |
| `solve` | `solve [<input.json>\|-] [zero-file flags] [--suggest]` | The explicit authoring door (**04**): road + turn-in → co-solved ideal line, self-verified by re-running the engine. `--suggest` reports the feasible turn-in band only. Non-clean solve exits 3 (the authoring gate). |
| `mistake` | `mistake <kind[:k=v,…]> --on <solved.json> [--corners c1,c2]` | Compile a mistake line off an existing solved line (**03**); append it to the envelope. Also available as repeatable `--mistake` sugar on `run`/`solve`. |
| `scene` | `scene <file.scene> [--check] [--out dir]` | Bake scene text (**03**) into a multi-line envelope + exported figures. `--check` lints the scene without solving — fixing the prior asymmetry where scene errors surfaced only during a full bake. |
| `render` | `render <envelope.json> --views topdown,controls,pov [--mode true\|diagram] [--at <s> \| --every <m>] [--out dir]` | Write SVG files + a manifest. `pov` renders frames at `--at`/`--every` stations. `--mode` selects the top-down projection (**06**); default `diagram`. |
| `compare` | `compare <A.json> <B.json> […] [--lock station\|time] [--out dir]` | Run all inputs, emit per-line verdict deltas plus a station-aligned metric diff (sight, speed, lean, grip at shared stations) and an overlay figure. |
| `sweep` | `sweep <scenario> --param plan.<id>.<field> --range a:b:step [--param2 …] [--metric list]` | Grid-sweep 1–2 fields (id-addressed, never array-indexed — carried), TSV/JSON table of metrics per cell, capped grid with an explicit `truncated` flag. |
| `check` | `check <scenario.json\|file.scene> [--road …]` | Validate only; no simulation. Exit 0 valid / 2 invalid, with `schema_ref`s on every error. |
| `schema` | `schema [<section>]` | Print every input schema, or one named section (§5.1). |
| `explain` | `explain <envelope.json \| checkId \| errorCode>` | Narrate a result (outcome → diagnosis → per-check evidence → remediation hints), or explain one doctrine check or error code. JSON out, agent-parseable. |
| `serve` | `serve <scenario\|scene\|envelope> [--port N]` | Launch the viewer (**07**) with the payload preloaded; print the URL; run until closed. |
| `export` | `export <envelope.json> --as share-url\|trace-csv\|svg\|envelope [--out …]` | Produce shareable artifacts (**05**): the share string (`#f=` FigureSpec, full line set per D6; `#s=` for a bare single scenario), the per-metre trace CSV, figures, or the canonical envelope. |

### 3.1 Exit codes (carried unchanged)

Exit codes encode **outcome tiers, not sim success**. A crash is a valid,
interesting run.

| Exit | Meaning |
|---|---|
| `0` | Ran — any physics outcome (`clean`, `wide`, `runoff`, `violation`, `crash`). |
| `2` | Bad input: schema violation, unknown verb/flag, unparseable DSL. stdout still carries typed JSON errors. |
| `3` | Doctrine tier: `run --gate` with a failed doctrine check, a non-clean `solve`, or (per **09**) a failed test/gate run. |
| `1` | A write failed (SVG/CSV/manifest); never masks the doctrine tier. |

### 3.2 Output discipline

- **stdout is exactly one JSON document per invocation** — the envelope, the
  validation report, the schema text (wrapped), the table. Nothing else. An agent
  may always `JSON.parse(stdout)`.
- **stderr is for humans**: progress, hints, pretty tables. `--pretty` renders the
  JSON human-readably (still valid JSON); `--quiet` silences stderr.
- Every error is `{ok:false, error:{code, at, message, schema_ref?}}` with `code`
  from the closed vocabulary (§7.2) — greppable across a whole agent session.

---

## 4. The zero-file path

The prior design required a file on disk for its authoring door. linelab requires
none: **every field an authoring input can carry has a flag**, so one command goes
from nothing to a simulated, judged, rendered scenario.

```
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" \
            --entry 55 --profile street --turn-in auto \
            --mistake early_apex
```

…composes the road from the DSL, solves the ideal line at 55 km/h with an
auto-placed turn-in, compiles an `early_apex` mistake line beside it, runs both,
and emits a two-line envelope. Add `--out fig/ --render diagram` to write the
book-style figure in the same breath, or swap `run` for `serve` to open it in the
viewer.

### 4.1 The flag set

Flags mirror schema fields one-to-one; the mapping is itself a printed schema
section (`schema cli`). The authoring flags: `--road`, `--entry <km/h>`,
`--profile <casual|street|trained|racer>`, `--mu <f>`, `--turn-in <auto|s>`,
`--brake <auto|decel>`, `--throttle <spec>`, `--position <spec>`,
`--occluder <spec>` (repeatable, **03**), `--mistake <spec>` (repeatable),
`--visibility-governed`, `--line-id <id>`. Anything expressible by flag is
expressible in JSON and vice versa — flags are sugar, not a second schema.

### 4.2 Precedence

1. Start from the file (or stdin) if given, else from an empty input.
2. Apply flags; **a flag always overrides the corresponding loaded field** (the
   carried `--road` rule, generalized).
3. Validate the composed input as if it had been a file — same entry point, same
   errors, same `schema_ref`s. Flag-composed and file-composed scenarios are
   indistinguishable downstream, including in the envelope's recorded input.

---

## 5. Self-documentation: `schema` and `explain`

### 5.1 `schema`

`linelab schema` prints the complete input contract; `linelab schema <section>`
prints one section. Sections (closed list, versioned with the schema):
`scenario`, `plan`, `road-dsl`, `occluders`, `mistakes`, `scene`, `view`,
`envelope`, `cli`. Two content rules matter for agents:

- **The mistakes section is a teaching table**: each kind carries its parameters
  *and defaults*, its canonical outcome under Tier 1R, and its book-figure
  mapping (e.g. `early_apex` → "turned in too soon, runs wide" → Fig 8.1/8.2's
  red line; `premature` → the contained early-turn-in variant). The prior design
  buried the premature/early_apex distinction — a documented first-try trap;
  here the schema output itself disambiguates.
- **The envelope section documents outputs**, not just inputs — an agent reading
  `schema envelope` learns the Sample fields, the events list, and the verdict
  shape (**05**) without running anything.

### 5.2 `explain`

`explain` closes the loop from output back to understanding:

- given an **envelope**: the headline outcome, the diagnosis chain (cause →
  station → corner), every doctrine check with verdict and evidence stations, and
  remediation hints phrased against the closed vocabularies ("`late_brake` at
  s=141: brake action b1 ends 9 m past turn-in; move `plan.b1.at_s` earlier or
  reduce `--entry`");
- given a **check id or error code**: its definition, arithmetic, and doctrine
  source (**01**/**05**).

`explain` output is JSON with fixed keys; the prose lives in `message` fields, so
an agent can act on the structure and a human can read the sentences.

---

## 6. Agent recipes

Five canonical end-to-end sequences; **09** pins each as an executable acceptance
test so the recipes cannot rot.

**(a) Ideal line on a small road.**
```
linelab run --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto
```
Expect: exit 0; envelope with one `ideal` line, `outcome: clean`, late apex
(`apex_pct` in the doctrinal band), and events including brake, turn-in, apex.

**(b) Ideal + mistake overlay figure.**
```
linelab run  --road "lane 3.5 | S 20 | R 25 ^90 | S 25" --entry 55 --turn-in auto \
             --mistake early_apex --out out/fig81.json
linelab render out/fig81.json --views topdown --mode diagram --out out/
```
Expect: two-line envelope (green ideal, red `early_apex` running wide per Tier
1R); a compact book-proportioned SVG that passes the proportion gate (**06**).

**(c) Blind-corner visibility compare.**
```
linelab solve --road "lane 3.5 | S 30 | L 30 ^100 | S 30" --entry 60 --turn-in auto \
              --occluder "hedge inside entry:c1-25 -1.0x30" \
              --out out/geom.json
linelab solve … (same road/occluder) --visibility-governed --out out/vis.json
linelab compare out/geom.json out/vis.json --lock station
```
Expect: a station-aligned diff showing the visibility-governed line's larger
`sight_m` through the approach, its lower entry speed, and both verdicts; the
overlay figure shows the hold-wide entry. `serve` on either envelope scrubs it
(**07** §4.3).

**(d) Linked chain with a per-corner mistake.**
```
linelab run --road "lane 3.5 | S 15 | R 30 ^70 | S 5 | L 25 ^80 | S 20" \
            --entry 55 --turn-in auto --mistake "early_apex@c1,c2"
```
Expect: a chained ideal line (solved corner-by-corner, **04**) plus a mistake
line turned in early at *both* corners, showing the book's error-amplification
through a sequence; colours per each line's own verdict (D9 — a contained-but-
good chained line is green, fixing the prior defect).

**(e) A named book figure.**
```
linelab scene figures/fig-08-01.scene --out out/
```
where the scene text (**03**) names the `book90` road preset, an ideal line, an
`early_apex` mistake line, and the hedge occluder (sight rays are drawn
automatically whenever occluders are present — **06** §3.1). Expect: a figure
equivalent to the book's Fig 8.1 — green delayed-turn line, red early-apex line
(the book's *premature turn point* error, authored via `early_apex`; the
`premature` kind is the contained/amber variant — see **03** §7.1's naming-trap
note), hourglass turn-point markers, dashed sight rays to each line's limit
point — in book proportions via the diagram projection.

---

## 7. The programmatic API

### 7.1 The CLI is a shell

Every verb is a thin wrapper over importable pure functions — the CLI parses
argv, calls the same function an agent could import, and serializes the Result:

```
import { run, solve, compileMistake, compare, sweep,
         validate, renderViews, explain, stateAt } from "linelab"
```

All are pure and synchronous over frozen inputs; **IO lives only in `cli/` and
`viewer/`**. No API function throws across its boundary: fallible operations
return `{ok:true, value} | {ok:false, error}` (Results over exceptions, carried).
The envelope a function returns is the same object the CLI would print — there is
no CLI-only enrichment.

### 7.2 The closed error vocabulary (carried, one addition)

| Code | Meaning |
|---|---|
| `SCHEMA` | Malformed input / bad field (carries `schema_ref`) |
| `DUP_ID` | Duplicate plan-action / segment / occluder / line id |
| `OUT_OF_SCOPE` | A deliberate scope cut (low-speed U-turn regime, vertical geometry, …) with the placard text |
| `UNKNOWN_ID` | Addressed an id that does not exist |
| `BAD_RANGE` | Non-physical number (negative radius, `mu ≤ 0`, …) |
| `NO_SOLUTION` | A solver found no feasible target (**04**'s typed sub-reasons ride in `at`/`message`) |
| `INEFFECTUAL` | **New (D8):** input that would validate but provably do nothing — rejected, naming the dead field |
| `INTERNAL` | An invariant believed impossible |

`NOT_IMPLEMENTED` from the prior vocabulary is retired: a thing is in the schema
and effectual, or it is `OUT_OF_SCOPE`/`SCHEMA` — there is no accepted-but-
unbuilt tier (that tier is what D8 exists to abolish).

---

## 8. Relation to the prior design

Carried unchanged: the single-binary/single-IO-edge stance; exit-code tiers
0/2/3/1 with their exact meanings; machine JSON on stdout, humans on stderr;
`--road` as a non-persisted override; id-addressed sweep paths; the closed,
greppable error vocabulary; Results over exceptions end to end.

Changed or new:

- **Schema-complete**: the authoring input finally has a printed schema; `schema`
  gained sections, the mistakes teaching table, and the envelope (output) section.
- **The zero-file path**: full scenario composition from flags/stdin; the prior
  design's file requirement is gone.
- **`run` as universal front door** that delegates to the solver when the input
  requires it — one verb for an agent to remember, with the explicit `solve`
  retained for authoring-specific control.
- **`scene --check`**: scene lint without a bake.
- **`serve`**: CLI-to-viewer handoff (the prior viewer had no launcher; `url`'s
  role is absorbed by `export --as share-url`, now carrying the *full line set*
  per D6 rather than the good line only).
- **`explain` narrates whole results**, not only check ids.
- **`INEFFECTUAL`** added and `NOT_IMPLEMENTED` retired, closing the
  accepted-but-inert input class (D8) that produced the prior design's silently
  dead `position` actions.
