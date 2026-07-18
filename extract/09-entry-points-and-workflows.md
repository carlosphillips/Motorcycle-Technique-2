# Entry Points & Workflows — Operational Reference

This is the operational map of the Motorcycle Cornering Course project: **every entry point** by which a human or agent drives the system, and **every workflow** by which the system's artifacts get changed and re-verified. It is organized in two parts:

- **Part A — Entry Points**: the simulator CLI (one binary, `node simulator/cli.mjs`, with a full verb table), the four Python tools, the read-only viewer HTML, and how to open the course itself.
- **Part B — Workflows**: numbered, step-by-step loops for editing a diagram, re-baking a scene, changing course content, authoring a figure from physics, shipping a milestone, and re-extracting the book.

A recurring principle underlies the whole map: **the physics core is pure and Result-based and never throws across a boundary; all IO and all fallibility surface at the edges** — the CLI, the Python tools, and the browser UI. Correspondingly, almost every workflow ends not at "it ran" but at an independent verification gate (a non-zero exit code, a byte-identical re-bake diff, or a vision subagent's verdict).

---

## Part A — Entry Points

### A.1 The simulator CLI — one binary, all verbs

The simulator has exactly **one entry point**, run from the repository root:

```
node simulator/cli.mjs <subcommand> [args] [--flags]
```

`cli.mjs` is deliberately the **sole IO edge** of the simulator: the only place (besides the test suite and the browser `ui/` layer) permitted to touch `process`, `fs`, or `zlib`. Its job is to load a scenario, call into the pure core/author stack, translate typed `Result` errors into machine-readable JSON on **stdout**, keep human diagnostics on **stderr**, and encode outcome semantics into **exit codes** so an agent can script around it deterministically.

It exports `main(argv, io = defaultIO)` and only auto-runs when invoked directly (`invokedDirectly` guard), so tests can import and drive it in-process with an injectable `io = {out, err}` without spawning a subprocess. Argument parsing is a hand-rolled `-- name value` / boolean / repeatable scanner (`parseArgs`) — no external arg-parsing library.

#### Verb table

The verbs split into **v1 simulation verbs** (`run sweep compare render check schema explain url decode`), the **dev/test verb** (`test`), the **scene-baking verb** (`scene`), and the **v2 authoring verbs** (`author suggest`).

| Verb | Syntax | Purpose |
|---|---|---|
| `run` | `run <scenario.json> [--events] [--checks] [--trace out.csv] [--gate] [--road "<dsl>"]` | v1: run the physics sim, emit the verdict JSON. `--gate` turns `expect_fail` mismatches into exit 3. |
| `sweep` | `sweep <scenario.json> --param <spec.path> --range a:b:step [--param2 path:a:b:step] [--metric list] [--road "<dsl>"]` | Grid-sweep one or two scenario fields; print a TSV table of metrics per combo. |
| `compare` | `compare <A.json> <B.json> [--out dir] [--road "<dsl>"]` | Diff two scenarios' specs + verdicts; render an overlay SVG (B as ghost over A). |
| `render` | `render <scenario.json> [--views topdown,controls] [--annotate] [--out dir] [--road "<dsl>"]` | Run + rasterize named views to SVG files + a `manifest.json`. Exit 1 if any view fails. |
| `check` | `check <scenario.json> [--road "<dsl>"]` | Validate only (no full sim run); exit 0 valid / 2 invalid, always with `road_summary`. |
| `schema` | `schema` | Print the scenario JSON schema text + the `--road` DSL grammar. |
| `explain` | `explain <checkId>` | Print the human explanation of one doctrine check id. |
| `url` | `url <scenario.json \| file.scene> [--scene <file>] [--road "<dsl>"]` | Encode a scenario (or a scene's solved good line) into a `file://…/embed.html#s=…` shareable link. |
| `decode` | `decode <hash \| url>` | Inverse of `url` — decompress and print the scenario JSON. |
| `test` | `test [substr]` | Spawn `node --test tests/*.test.mjs` (optionally basename-filtered); summarize TAP into JSON. |
| `scene` | `scene <file.scene> [--out dir] [--stamp <chapter.html> --fig <guard-id> [--init-guards --replace-svg <NN>]]` | Bake a `.scene` → static/animated SVG + receipts; optionally stamp the animated SVG + regenerated `<figcaption>` into a chapter between guard comments. |
| `author` | `author <input.json> [--out dir] [--figure path.svg] [--png] [--mistake <spec> …] [--naive] [--road "<dsl>"]` | v2: road + turn-in → co-solved brake/roll → engine self-verify → book-style figure SVG. Gates by default (non-clean → exit 3). |
| `suggest` | `suggest <input.json> [--road "<dsl>"]` | v2: report the cleanable late-apex turn-in band without producing a figure. |

#### Shared flags

- **`--road "<dsl>"`** — accepted by every verb that reads a scenario or author-input file (`run`, `sweep`, `compare`, `render`, `check`, `author`, `suggest`, `url`). Parsed by `parseRoadDSL` and **overrides** the loaded JSON's `.road` field at read time — it is never persisted back to the file. A bad DSL string surfaces the parser's token-anchored error as the same typed exit-2 error every verb uses (implemented once, in `readScenario(path, roadFlag)`). Rationale: an agent can explore road-geometry variants from one line without maintaining N JSON files.
- **Boolean flags** (`BOOL_FLAGS`): `events, checks, gate, annotate, png, naive, init-guards`.
- **Repeatable flag** (`REPEATABLE_FLAGS`): `mistake` — each `--mistake <spec>` occurrence appends to an array (e.g. `author --mistake premature:early_by_m=18 --mistake chop`).

#### Exit-code semantics

Exit codes encode **outcome tiers, not the success/failure of the simulation itself**. A crash/runoff/violation scenario is a perfectly valid run and exits 0 — the code distinguishes "the sim ran and reported a bad line" from "your input was malformed" from "you asked for a clean figure and didn't get one."

| Exit | Meaning |
|---|---|
| `0` | Simulation ran — **any** outcome (`clean` \| `wide` \| `runoff` \| `violation` \| `crash`) is exit 0. |
| `2` | Spec invalid / bad input. stdout is still JSON (typed errors + `road_summary`). Also: unknown subcommand (prints USAGE), or any uncaught handler exception (emitted as `{ok:false, error:{code:"internal",…}}` + stack to stderr). |
| `3` | Doctrine failure under `--gate` (`run`), a non-clean `author` figure, or any `test` failure (same tier as the doctrine gate). |
| `1` | A render/figure **write** failed (`render` verb: exit 1 if any view fails; `author`: only a failed SVG write, never a failed PNG). |

Summarized in the CLI's own USAGE line: *"exit: 0 ok/clean · 2 spec/input invalid · 3 doctrine gate fail (author non-clean, or run --gate) · 1 figure/render write failed."*

#### The `--road` DSL grammar (printed verbatim by `schema`)

```
road DSL (--road "<dsl>") — segments separated by "|":
  lane <w>              lane width in metres — FIRST segment, exactly once
  S <len>               straight, length in metres
  L|R <r> ^<deg>        arc: hand (L/R), radius m, turned angle in degrees
  L|R <r1>><r2> ^<deg>  taper: radius r1 -> r2 over the turned angle (decreasing/increasing)
corner ids c1, c2, … are minted in segment order.
example: lane 3.5 | S 120 | R 60 ^90 | S 40
```

Number lexing is a strict positive-decimal regex (`^\d*\.?\d+$`) that rejects signs, extra dots, and empties so a malformed token can never silently become `0`/`NaN`. `bike_margin_m`, `use_full_width`, `line_type`, and `ds_m` are deliberately **not** DSL-expressible — they are left to `compose()`'s defaults, so `print(parse(s))` round-trips as an identity over exactly the expressible subset (simplicity over DSL completeness).

#### Per-verb behavioural notes

- **`run`** reads the scenario, calls `SIM.simulate.run`, and emits the verdict JSON (a mutable deep-copy, since the core freezes results). `--trace out.csv` writes a Tier-3 per-metre CSV (`s, d, f, v_kmh, kappa, lean_deg, a_long, grip_margin, sight_m, ssd_m, brake, throttle`, downsampled to whole-metre stations) and adds `verdict.files.trace`. `--events` prints a Tier-2 station-ordered event log to stderr (UPPERCASE lines are violations, so `rg SIGHT` / `rg CRASH` work). `--checks` prints a full doctrine scorecard (every check id as `[FAIL]/[WARN]/[na]/[pass]`).
- **`sweep`** parses 1–2 `--param path --range a:b:step` axes. The path syntax is `plan.<id>.<field>` to address a plan action **by id** (never array index, so reordering a plan cannot silently corrupt a sweep), else a plain dotted property walk. `parseRange("a:b:step")` yields the inclusive list while `<= b` (with a `step*1e-9` epsilon); the third field is the increment (`106:130:4` → 7 rows). The grid is capped at 100 rows (`truncated` flag to stderr). Default metrics: `apex_pct, exit_f, lean_max, grip_min, sight_min, outcome, note`.
- **`compare`** runs both scenarios and renders a top-down overlay with B drawn as a red `ghost` (`quality:"mistake"`), emitting `{a, b, a_result_hash, b_result_hash, changed_spec, delta, overlay}`. `changed_spec` matches plan actions by `id`; `delta` is a per-corner verdict-field diff plus `doctrine.{newly_pass, newly_fail}`.
- **`render`** rasterizes each named view (`--views topdown,controls`, default both), validates the output is real SVG (not the "view unavailable" fallback), writes `<scenario>-<view>.svg` and a `manifest.json`, and exits 1 if any requested view failed.
- **`url` / `decode`** round-trip a scenario through **base64url-over-deflateRaw** (`deflateRawSync`/`inflateRawSync`, `+`→`-`, `/`→`_`, `=` stripped) into a `file://…/embed.html#s=<payload>` hash. `decode` accepts a bare payload, `s=PAYLOAD`, or a full URL. **Honesty constraint**: the `#s=` hash carries exactly one trajectory, so for a `.scene` input only the solved **good line** rides the URL — mistake/naive overlays stay figure-only, by design.
- **`test`** enumerates `tests/*.test.mjs` under `simulator/tests/`, applies an optional basename substring filter, and spawns `node --test --test-reporter=tap`. It strips `NODE_TEST_CONTEXT` from the child env so a `node --test` spawned from inside a test run still emits its own TAP summary instead of entering child-reporter mode. It parses the aggregate `# tests / # pass / # fail / # duration_ms` lines and emits `{ok, tests, pass, fail, duration_ms}`, exit 0 all-green / 3 on any failure.
- **`author`** parses all `--mistake` specs first (fail-fast, exit 2 on a bad token), builds the author input, runs `authorFigure`, writes the SVG (default `out/<id>-authored.svg`, override with `--figure`), and — if `--png` — best-effort rasterizes via a shelled-out `cairosvg`. **PNG failure never affects the exit code** (still `clean?0:3`); only a failed SVG write is exit 1, so "a cairosvg/uv env hiccup must not mask the doctrine gate." (Platform note: `DYLD_FALLBACK_LIBRARY_PATH` is set **inline in the shell string**, not via `execSync`'s `env:` option, because macOS SIP strips `DYLD_*` across the `/bin/sh` exec.)

### A.2 The four Python tools

All four are **PEP 723 self-contained scripts** (`# /// script` header with inline `dependencies`), run as `uv run tools/<script>.py` — no venv, no `requirements.txt`. Two extract raw material from the book; two are render gates.

| Tool | Invocation | Role |
|---|---|---|
| `tools/extract_book.py` | `uv run tools/extract_book.py` (no args) | Unpack the `.azw3`/`.mobi` → `book_text/`. |
| `tools/extract_images.py` | `uv run tools/extract_images.py` (no args) | Unpack figures + captions → `book_images/`. |
| `tools/render_diagrams.py` | `uv run tools/render_diagrams.py [file.html …] [--out DIR]` | **The diagram verifier** — course SVG → PNG, exit non-zero on any failure. |
| `tools/render_sim_views.py` | `uv run tools/render_sim_views.py [--selftest] [--out DIR] <svg…>` | The simulator's arm of the same render gate. |

**`extract_book.py`** (deps `mobi>=3.3`, `requires-python >=3.11`) discovers the book via `find_azw3()` (globs `*.azw3` then `*.mobi`, first sorted hit; exits `"No .azw3/.mobi found in repo root."` if none). It **wipes and rebuilds** `book_text/` each run, parsing OPF spine order + NCX titles, stripping each xhtml part to text via a custom `HTMLParser`, and writing `parts/part{NNNN}__{slug}.txt`, the whole-book `total-control-fulltext.md`, and a `PARTS.tsv` index. Core line doctrine lands in `book_text/parts/part0014__chapter-8-line-selection.txt`.

**`extract_images.py`** (deps `mobi>=3.3`) uses the same `find_azw3()` and the same wipe-and-rebuild discipline over `book_images/`. It streams four token kinds (page anchor, figure anchor, `<img>`, caption) in document order and attaches each caption to the most-recently-seen image (a caption always *follows* its image). It sniffs pixel dimensions with a hand-rolled JPEG/PNG/GIF header parser (no PIL), writing `images/image{NNNNN}.jpeg` (all raw extracts), `by-figure/fig-{CC.NN}[__{slug}].jpeg` (numbered figures only), plus `figures.json` and `FIGURES.tsv` indices.

**`render_diagrams.py`** (deps `cairosvg>=2.7`) is *"the backpressure that keeps diagram edits honest."* Its behaviour is detailed in Workflow B.1; operationally: with no args it renders all `cornering-course/[0-9]*.html` plus `glossary.html`/`index.html`; with filename args it restricts to those. It writes `rendered/{stem}_svg{NN}.png` (2× scale) + `rendered/manifest.json`, and **`sys.exit(1)` if any SVG failed to render**. It carries a macOS-specific one-time libcairo bootstrap: at import it scans Homebrew/MacPorts lib dirs for `libcairo.2.dylib`, sets `DYLD_FALLBACK_LIBRARY_PATH`, and `os.execv`-re-execs itself once (guarded by `_CAIRO_REEXEC`), so `uv run` needs no wrapper env.

**`render_sim_views.py`** (deps `cairosvg>=2.7`) deliberately does **not** re-implement that bootstrap — it `import render_diagrams` purely for the side effect of triggering that re-exec block, and reuses `render_diagrams.SCALE`, `.VIEWBOX_RE`, and `.ensure_namespaces` directly. `--selftest` rasterizes a trivial fixture SVG to prove the libcairo bootstrap works (exit 0/1). Without `--out`, each SVG rasterizes next to itself; with `--out DIR`, into `DIR/{stem}.png`. Same per-file try/except + `sys.exit(1)`-on-any-error gate as `render_diagrams.py`, but it writes **no** manifest.

### A.3 The read-only viewer (browser)

The viewer is a separate, deliberately **read-only** presentation layer over the same physics core — no drag/edit/hit-testing (deferred to "v1.5"). It runs entirely from `file://` with **no server**: classic `<script src>` loads (no ES modules, no `fetch`), in the identical order the CLI's `core/load.mjs` uses, so browser and CLI runs are byte-identical (the "one-core guarantee").

| HTML entry | Role |
|---|---|
| `simulator/app/index.html` | The full workstation: preset dropdown, import/export, a two-pane top-down + controls grid, tabs on narrow widths. Loads catalog presets only; its `#s=` hash handling is inert. |
| `simulator/app/embed.html` | The slim, iframe-able shell — the **one** viewer that actually parses the `#s=` hash. Its entire config lives in the URL (`#p=<preset-id>` or `#s=<compressed-json>`), so a course chapter or shared link can embed a specific scenario with no server-side state. |

To view a shared scenario: run `node simulator/cli.mjs url <scenario|scene>` to get a `…/embed.html#s=…` link, then open it. (The embed decodes with the browser `DecompressionStream`, trying `"deflate"` then `"deflate-raw"` then raw JSON; the CLI always encodes with raw deflate.)

### A.4 The HTML course

The course (`cornering-course/`) is a **zero-build** artifact: 15 numbered chapters (`01-…html` … `15-…html`) plus `index.html`, `glossary.html`, and `assets/` (`style.css`, `quiz.js`). There is **no entry command** — you open the HTML directly in a browser:

- **`cornering-course/index.html`** — the course home / hub: two module grids of `<a class="card">` tiles linking each chapter, a one-paragraph spine summary, and a primary-references list.
- Any chapter file, e.g. **`cornering-course/05-corner-anatomy.html`**, opens standalone. Every page has sticky nav chrome (brand → `index.html`, links to `index.html`/`glossary.html`), a bottom `<nav class="pager">` Previous/Next, `assets/style.css` linked in the head, and `assets/quiz.js` loaded at the end of `<body>` (it auto-wires every `.quiz` block on `DOMContentLoaded`, no exported API).
- **`cornering-course/glossary.html`** — a single alphabetized table (Term / Meaning / Module) linking each term to its fullest chapter treatment.

Naming convention used by the render harness: the **N-th `<svg>` in a file is Fig chapter.N**, rendering to the id `{file-stem}_svgNN` (e.g. Fig 5.6 → `05-corner-anatomy_svg06`). This mapping is positional/derived by the tool, not embedded as `id=` attributes in the HTML.

---

## Part B — Workflows

Every workflow below is a loop that ends at a **verification gate**, never at "it ran." The gates differ by artifact: rendered PNGs judged by a vision subagent (diagrams), a byte-identical re-bake diff (scenes), a claim checked against the book (content), an engine self-verify (authored figures), byte-stability tripwires + green tests (milestones).

### B.1 The diagram-edit loop (hand-authored figures)

For a course figure whose provenance is **`hand`** in `line-diagram-audit.md` (edited normally, not scene-baked):

1. **Edit** the inline `<svg>` in the chapter HTML. Diagrams are fully self-contained: inline `fill`/`stroke`/`<defs>`, no external CSS supplying colour or geometry, so the SVG renders standalone. Obey the colour code — **green `#1f6f43` = good/ideal line, amber `#b07d1e` = geometric/middling, red `#b32e2e` = the mistake** — and the ideal-line shape: a single smooth-arc, **late-apex, outside–inside–outside** path.
2. **Render** the touched file: `uv run tools/render_diagrams.py 05-corner-anatomy.html` (or all files with no arg; `--out /tmp/after <file>` to render into a scratch dir). This must **exit 0** — any SVG that fails to render makes the tool `sys.exit(1)`, which blocks the loop. It writes `rendered/{stem}_svgNN.png` at 2× scale + a `manifest.json`.
3. **Judge** the rendered PNG against `STANDARD.md`'s **two-axis test**: (A) physical plausibility and (B) doctrinal correctness. Confirm each drawn line stays on the road surface, touches the edges it is supposed to touch, runs wide *only* where a mistake is being taught, and matches its caption and labels.
4. **Mandatory vision-subagent sign-off.** Per `CLAUDE.md`, this visual judgment must be done by a **separate subagent** — never the editing agent's own eyeball. The subagent's job is exactly: (a) re-render the touched figure, (b) read the PNG with vision tools, (c) judge it against `STANDARD.md`. *"The geometry math can be exactly right while the picture reads wrong"* — arrows spilling into the grass, a "good" line that visually appears to run wide, callouts pointing at empty space. **The subagent's visual verdict — not the arithmetic — is the gate for calling the change done.**

### B.2 The scene re-bake loop (scene-baked figures)

Thirteen course figures are **compiled** from `.scene` files (provenance `scene:<file>` in `line-diagram-audit.md`): Figs 1.2, 5.1, 5.3, 6.1, 6.3, 6.4, 6.7, 10.2, 10.4, 10.5, 10.6, 10.8, 14.5. For these, **never hand-edit the stamped SVG** — the next re-bake would silently overwrite it, since the chapter HTML between `<!-- scene:fig-CC-NN:start -->` / `<!-- scene:fig-CC-NN:end -->` guards is machine-owned.

1. **Edit the `.scene` file** in `cornering-course/scenes/` (e.g. `fig-05-03.scene`). You author only physical inputs — a road (one DSL line), a good-line entry speed + turn-in, optional mistake/alt/naive lines, optional labels/marks/obstacles, a `note`, and an `exag` knob. Apex, exit, run-wide, lean reserve, and outcome all emerge from the engine.
2. **Bake + stamp**: `node simulator/cli.mjs scene <file> --stamp <chapter.html> --fig <guard-id>`. This always writes three artifacts under `--out` (default `simulator/out/scenes`): `<stem>.static.svg`, `<stem>.animated.svg`, `<stem>.receipts.json`; and with `--stamp`+`--fig` it replaces the content strictly between the guards with the animated SVG + a regenerated `<figcaption>`. Both `--stamp` and `--fig` are required together (exit 2 otherwise); plain `--stamp` refuses if guards are absent, duplicated, or out of order.
3. **The idempotence gate**: re-run the exact same bake+stamp command; the diff against the chapter HTML must be **empty**. Bake is pure and deterministic (same `.scene` text → byte-identical SVG + receipts), and `stampBetweenGuards` is designed to be byte-idempotent, so a non-empty re-bake diff is a failure signal. The regenerated `<figcaption>` preserves the prior `<strong>Fig N.N — Title.</strong>` lead-in verbatim so hand-written caption titles survive re-stamps.
4. **Render + vision-judge** the stamped chapter through the same gate as B.1: `uv run tools/render_diagrams.py <chapter.html>` clean, then a vision subagent judges the PNG against `STANDARD.md`. (For scene figures, Axis A physical plausibility is largely *true by construction* — the line came from the physics engine — so the subagent's job shrinks to Axis B doctrine spot-checks and legibility.)

**One-time guard introduction** is a separate, deliberately non-idempotent operation: `--init-guards --replace-svg <NN>` wraps the NN-th `<svg>` (1-based) and its following `<figcaption>` in a fresh guard pair. It **refuses if the guard id already exists**; plain `--stamp` refuses if guards are *absent*. This asymmetric friction is intentional so guards are never silently created or silently re-introduced.

### B.3 The content-change loop (a factual/metric claim)

For prose, numbers, quotes, or metric conversions in the course:

1. **Make the change** in the chapter HTML. Course prose is **metric throughout** (km/h, m, m/s, degrees); the book is US units, so numeric agreement is by *correct conversion*, not verbatim copy (mph→km/h ×1.609; ft→m ×0.3048).
2. **Check the claim against the book** — the `.azw3` is ground truth, distilled into `STANDARD.md` (doctrine) and available as committed text in `book_text/` (read `book_text/parts/part0014__chapter-8-line-selection.txt` for line doctrine). When course and book disagree, **the book wins**. For a number you touched, verify the conversion arithmetically; for a doctrine claim, confirm it against the book text (and Part II "synthesis" claims should be flagged as the course's own extension, not attributed to Parks).
3. **Verification before done**: a content change isn't finished until the claim checks against the book. `content-fidelity-audit.md` is the standing fix-list; note its recurring failure mode — cross-chapter "twin" errors, where the same imperial leftover or misquote appears in more than one chapter, so a fix should sweep for siblings.

### B.4 The figure-authoring loop (author a figure from physics)

This is the v2 authoring front door — *"hand it a road + turn-in, it solves the line and self-verifies."* Its thesis is stated in every author module: **physics is the validator, not the generator.** There is **no apex input anywhere** — the author supplies only a road and a turn-in (plus optional brake/roll or mistake specs); everything doctrine-relevant emerges from running the real point-mass engine.

1. **Author the input** — a JSON scenario (or `--road "<dsl>"`) naming the road, target corner, rider profile, and a turn-in. Set `turn_in: "auto"` to let the placer find the latest clean turn-in, or give an explicit `turn_in_m`.
2. **Solve**: `node simulator/cli.mjs author <input.json>`. Internally `authorFigure` composes the road, resolves the corner + rider profile, and (for `auto`) calls `suggestTurnIn`. Then `solve()` co-solves the two near-independent controls by monotone bisection against the real engine: brake `decel` → apex lean = `leanFrac × RESERVE_DEG` (≈ `0.70 × 40.36°`), and roll-on onset → exit lane-fraction = `exitTarget` (`0.85`). A cheap feasibility probe runs first — a turn-in placement problem (too early cuts inside, too late never reaches the apex) cannot be fixed by braking or throttle, so the solver short-circuits with an honest diagnostic rather than converging to a degenerate line.
3. **Self-verify**: after bisection, `solve()` **re-runs the engine on its own final plan** and returns that verdict verbatim — *"physics validates its own output,"* not the bisection's intermediate estimate.
4. **Figure**: `renderAuthorFigure` draws the composed road + solved line(s) to a self-contained SVG string (default `out/<id>-authored.svg`, or `--figure path.svg`). Lateral offset is exaggerated by `exag` (author default `2.5`) for legibility while the physics stays on true geometry. Optionally add red mistake overlays (`--mistake <kind[:params]>`, repeatable — each a one-perturbation red line compiled by `compileMistake`) and/or an amber `--naive` baseline (same turn-in, generic un-solved brake/roll — the "before" the co-solve improves on).
5. **Gate**: `author` exits **3** if the figure is non-clean (the doctrine gate), 0 if clean; `--png` rasterization is best-effort and never changes that. To only ask *"where should I turn in?"* without a figure, use `suggest`, which returns the feasible turn-in band.
6. **Render-then-vision-judge** any produced SVG through the simulator's gate: `uv run tools/render_sim_views.py <svg…>` (or `--selftest`) must exit 0, then a vision subagent judges the PNG against `STANDARD.md` — the same discipline as B.1/B.2.

Separate solvers exist for lines that `solve()`'s feasibility probe deliberately rejects: `solveGeometric` (the amber largest-radius, ~50%-apex line, turned in earlier than ideal), `solveDoubleApex` (the legitimate two-touch ch14 line), and `chainedSolve` (multi-corner linked roads, placed corner-by-corner). Each does its own fixed-plan forward search and **re-verifies at full engine resolution**, so *"a coarse/fine disagreement is a typed error, never a silently-wide shipped line."* These are what the `.scene` `alt style=geometric`, `style=double_apex`, and multi-corner cases in B.2 compile down to.

### B.5 The milestone / "next phase" loop

The project advances in audit-driven milestones. Each audit doc (`line-diagram-audit.md`, `content-fidelity-audit.md`, `simulator/NEEDS_IMPROVEMENT.md`) is explicitly *"a fix list consumed by the next loop,"* and `ROADMAP.md` tracks phases.

1. **Read the roadmap / derive the next phase** from `ROADMAP.md` (or from the outstanding items in the audit docs). The `next-phase` skill encodes this loop.
2. **Implement** with subagents (one focused task per subagent), respecting the standing architecture principles from `PLAN-scenes.md`: `core/` stays pure classic-script frozen-namespace (wired by `core/load.mjs`), no `package.json`/build; the authoring solver stays ESM in `author/`, not ported into `core/`; `figure.mjs`'s multi-line drawing is extended, never rewritten.
3. **Verify** on three independent mechanisms, each targeting a different failure mode:
   - **Green tests**: `node simulator/cli.mjs test` (or `node --test "simulator/tests/"*.test.mjs`) — 489 tests across 36 files must pass.
   - **Byte-stability tripwire**: `tests/preset-hashes.test.mjs` recomputes `spec_hash`/`result_hash` for every preset and asserts equality against committed fixtures. Any drift outside a **dedicated, deliberate re-bless commit** is a failure — this is what made the float-rounding change, the taper-segment addition, and the 8.2× LUT speedup all provably non-regressive.
   - **Render gate + vision judge**: for any diagram-affecting phase, `render_diagrams.py` / `render_sim_views.py` clean **plus** an independent vision subagent's sign-off (B.1/B.2).
4. **Merge and update** `ROADMAP.md`. The byte-stability contract is a hard rule: existing presets' hashes may change **only** in a dedicated re-bless commit (`bless-preset-hashes.mjs` / `bless-scene-goldens.mjs` regenerate the committed goldens — *"Never hand-edit a golden to make the test pass"*).

### B.6 The book re-extraction loop

You rarely need this — `book_text/` and `book_images/` are **committed**, so read them directly. The `.azw3` remains the ground truth; regenerate only when the extraction logic changes or the source book is updated.

1. **Confirm the source** — a single `*.azw3` (or `*.mobi`) in the repo root; both extractors discover it via `find_azw3()` (first sorted glob hit) and exit with a clear message if none is found.
2. **Re-extract text**: `uv run tools/extract_book.py`. This **wipes and rebuilds** `book_text/` — the 32 spine parts (`parts/part{NNNN}__{slug}.txt`, non-contiguous numbering), the whole-book `total-control-fulltext.md` (~475 KB), and `PARTS.tsv`.
3. **Re-extract images**: `uv run tools/extract_images.py`. This **wipes and rebuilds** `book_images/` — `by-figure/fig-{CC.NN}[__{slug}].jpeg` (87 numbered figures), `images/image{NNNNN}.jpeg` (258 raw extracts), plus `FIGURES.tsv` and `figures.json`.
4. Because both dirs are wipe-and-rebuild and committed, review the git diff to confirm the change is intended before committing.

---

## Cross-cutting: how the gates line up

| Artifact changed | Change command / edit | Verification gate |
|---|---|---|
| Hand-authored course SVG | edit chapter HTML | `render_diagrams.py` exit 0 → vision subagent vs `STANDARD.md` |
| Scene-baked course figure | edit `.scene` → `cli scene --stamp` | re-bake diff empty (idempotence) → `render_diagrams.py` → vision subagent |
| Course content / numbers | edit chapter HTML | claim checks against book (`STANDARD.md` / `book_text/`); conversions verified arithmetically |
| Authored physics figure | `cli author` / `suggest` | engine self-verify (re-run) → exit 3 if non-clean → `render_sim_views.py` → vision subagent |
| Simulator engine / phase | subagent implementation | `cli test` green + preset-hash byte-stability + render/vision gates |
| Book extraction | `uv run tools/extract_*.py` | wipe-and-rebuild; review git diff before commit |

The unifying design intent: **numeric or geometric correctness is necessary but never sufficient.** Every loop pairs a mechanical, zero-tolerance gate (a non-zero exit, an empty diff, a hash match) with a semantic judgment (a vision subagent reading the rendered picture, or a claim checked against the book) — because the math can be exactly right while the picture reads wrong or the prose drifts from doctrine.
