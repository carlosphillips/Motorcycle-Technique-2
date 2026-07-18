# Tooling, Render Gates & the Verification Regime

How the Motorcycle Cornering Course project *proves* that work is done rather than
asserting it. This document covers the four Python tools, the two render gates, the
render-then-vision-judge loop and why it exists, the simulator test suite and its
byte-stability tripwires, and the audit-doc-as-fix-list working style that ties it
all together.

---

## 1. The shape of the verification regime

The project derives two kinds of artifact from one ground-truth book (*Total Control*,
Lee Parks, committed as an `.azw3`): a set of **static course diagrams** (108 inline
SVGs across 15 HTML chapters) and a **physics simulator** that solves and renders
cornering lines. Both are subject to one house rule: **nothing is "done" until an
independent mechanism re-verifies it.** The regime has three independent legs, each
aimed at a different failure mode:

| Leg | Mechanism | Catches |
|---|---|---|
| Render gate + vision judge | `render_diagrams.py` / `render_sim_views.py` rasterize every SVG; a **separate subagent** reads the PNG against `STANDARD.md` | Pictures that are geometrically right but *read* wrong |
| Byte-stability tripwires | `preset-hashes.test.mjs` recomputes `spec_hash`/`result_hash` for every preset and scenario | Silent physics-output drift from an "unrelated" edit |
| Scene-golden round-trip | `scene-stamp.test.mjs` drives the real CLI against a fake chapter and asserts idempotent re-stamp | Regression in the scene→SVG→chapter bake/stamp pipeline |

These are deliberately kept as **separate legs**, never folded together — the render
gate is mechanical and zero-tolerance; the vision judge is human/agent judgement; the
hash tripwires are exact-equality asserts. Each is necessary; none is sufficient alone.

The underlying philosophy, stated across `CLAUDE.md` and both render scripts'
docstrings, is a single sentence:

> **"The geometry math can be exactly right while the picture reads wrong."**

Arrows spill off the asphalt into the grass; a "good" line visually appears to run
wide; callouts point at empty space. Numeric correctness is necessary but not
sufficient — only rendering to a raster and *looking at it* catches layout, legibility,
and doctrinal-reading failures.

---

## 2. The four PEP 723 Python tools

All four tools in `tools/` are **PEP 723 self-contained scripts** — each carries an
inline `# /// script` header declaring its own `dependencies` and `requires-python`, so
there is no `requirements.txt`, no virtualenv to manage, and no project-wide Python
dependency file. Every invocation is `uv run tools/<script>.py`; `uv` resolves and
caches the declared deps on the fly.

Two tools **extract** raw material from the book; two are **render gates** that turn
authored SVG into judgeable PNG and enforce a non-zero exit on any render failure.

| Tool | Deps (PEP 723) | Input | Output dir | Role |
|---|---|---|---|---|
| `extract_book.py` | `mobi>=0.3.3`, py ≥3.11 | first `*.azw3`/`*.mobi` in repo root | `book_text/` (wipe-and-rebuild) | Book text → per-part `.txt` + full-text `.md` + `PARTS.tsv` |
| `extract_images.py` | `mobi>=0.3.3` | same `.azw3`/`.mobi` | `book_images/` (wipe-and-rebuild) | Figures/captions → `by-figure/`, `images/`, `figures.json`, `FIGURES.tsv` |
| `render_diagrams.py` | `cairosvg>=2.7` | `cornering-course/*.html` | `rendered/` (git-ignored) | **The backpressure** — course SVG → PNG, gate |
| `render_sim_views.py` | `cairosvg>=2.7` | simulator `out/*.svg` | next to each SVG, or `--out DIR` | Simulator's arm of the same gate |

### 2.1 `extract_book.py` — book text extractor

**Invocation:** `uv run tools/extract_book.py` (no args or flags).

It finds the source via `find_azw3()` — globs `*.azw3` then `*.mobi` in the repo root,
takes the first sorted hit, and exits with `"No .azw3/.mobi found in repo root."` if
none exists. It calls `mobi.extract(...)` to unpack to a temp dir, reads the OPF
manifest to recover **spine order** (`OPF_NS = {http://www.idpf.org/2007/opf}`) and the
NCX navPoints for **part titles** (`NCX_NS = {http://www.daisy.org/z3986/2005/ncx/}`).
Each XHTML part is stripped to plain text by a custom `_Stripper(HTMLParser)`:
`<script>`/`<style>` bodies are skipped via a depth counter; block tags
(`<p><br><div><h1-4><li><tr>`) emit newlines; `<h1-3>` additionally emit a `## `
markdown prefix. Whitespace is collapsed. Parts under 20 characters are dropped (cover
and blank separators).

**Output** (`book_text/`, wiped and rebuilt each run via `shutil.rmtree`):

- `total-control-fulltext.md` — the whole book in spine order, chapters delimited by
  `"="*90` banners `[BOOK PART {fn}] {title}`.
- `parts/part{NNNN}__{slug}.txt` — one file per spine part (numbering is
  non-contiguous). Core line doctrine lives in
  `parts/part0014__chapter-8-line-selection.txt`.
- `PARTS.tsv` — grep-able index (`{fn}\t{len} chars\t{title}`).

The temp mobi extraction dir is removed at the end.

### 2.2 `extract_images.py` — figure/caption extractor

**Invocation:** `uv run tools/extract_images.py`. Same `find_azw3()` discovery. Same
wipe-and-rebuild of its output dir `book_images/` (recreating `images/` and
`by-figure/`).

The interesting design here is the **caption-association model**, documented in the
tool's own docstring. The AZW3 lays out an image block immediately followed by a
caption paragraph:

```
<div class="imgblock"><a id="f08-01"></a><img .../></div>
<p class="caption"><strong>Figure 8.1</strong><br/><em>Title</em>...
```

Because *a caption always follows the image it describes*, the extractor streams four
token kinds in document order via one combined regex (`TOKEN_RE`, matching a
`page_` anchor, an `f…` figure anchor, an `<img src=…>`, or a `<p class="caption">…`)
and attaches each caption to the **most recently seen image**. Images with no caption
before the next image (chapter openers, decorative panels, composites) are kept
**uncaptioned rather than dropped**. Figure numbers are parsed with
`FIGNUM_RE = Figure\s+(\d+)\.(\d+)`.

Pixel dimensions are read by a **hand-rolled header parser** (`image_size`, no PIL
dependency): it walks JPEG SOF markers, reads PNG width/height at byte offsets 16–24,
and GIF dimensions at 6–10; anything else returns `(None, None)`.

**Output:**

- `images/<original-name>.jpeg` — every spine-referenced image, deduped by filename.
- `by-figure/fig-{CC.NN}[__{slug}].jpeg` — only *numbered* figures, human-browsable.
  Filename collisions (composite figures sharing a number) disambiguate by appending
  the source image's own stem.
- `figures.json` — one record per `<img>` occurrence in reading order, full metadata.
- `FIGURES.tsv` — grep-able index of numbered figures only
  (`figure\ttitle\tchapter\tpage\tpixels\tfigure_file`).

Note: the two extractors **duplicate** their spine/title-extraction logic rather than
sharing a module — there is no shared code between them.

---

## 3. `render_diagrams.py` — "the backpressure"

This is the gate the whole diagram side of the project rests on. Its docstring states
the intent verbatim:

> "This is the backpressure that keeps diagram edits honest: any change to an SVG gets
> re-rendered to a PNG that can be eyeballed (or judged by an agent) against
> STANDARD.md, instead of trusted. It hit 0 render errors on the full 108-figure set."

**Invocation:**

```
uv run tools/render_diagrams.py                                   # all chapters -> rendered/
uv run tools/render_diagrams.py 05-corner-anatomy.html 14-multi-turn-library.html
uv run tools/render_diagrams.py --out /tmp/after 09-braking-trail-braking.html
```

With no arguments it renders `sorted(glob("[0-9]*.html"))` plus `glossary.html` and
`index.html` (if present) from `cornering-course/`. Explicit filename args (relative to
`cornering-course/`, or absolute paths) restrict the run to just those files.

### 3.1 The libcairo bootstrap (macOS self-contained re-exec)

cairosvg needs Homebrew's `libcairo`, which `uv run` won't put on the dynamic-loader
path. Rather than require a wrapper env var, the script **self-bootstraps at import
time**: if the env var `_CAIRO_REEXEC` is not `"1"`, it scans
`/opt/homebrew/lib`, `/usr/local/lib`, `/opt/local/lib` for `libcairo.2.dylib`,
prepends that directory to `DYLD_FALLBACK_LIBRARY_PATH`, sets `_CAIRO_REEXEC=1`, then
`os.execv`s itself (argv preserved). The re-exec'd process finds libcairo and proceeds.
This one-time trick means `uv run tools/render_diagrams.py` "just works" with no
environment setup — a design choice that pays off below because
`render_sim_views.py` reuses it *by importing this module*.

### 3.2 Naming convention (load-bearing)

SVGs are matched with `SVG_RE = <svg\b.*?</svg>` (non-greedy, so it stops at the first
`</svg>`). The **N-th `<svg>` in a file** (1-based) renders to `{stem}_svg{NN:02d}.png`.
So the 6th SVG in `05-corner-anatomy.html` becomes `05-corner-anatomy_svg06`, which is
Fig 5.6. This naming is a contract the whole project relies on to map a rendered PNG
back to a figure number in the chapter and in the audit docs.

### 3.3 Rendering and constants

| Name | Value | Meaning |
|---|---|---|
| `SCALE` | `2.0` | Render at 2× the viewBox "for crisp, judgeable PNGs" |
| `VIEWBOX_RE` | `viewBox="([\d.\s+-]+)"` | Extracts the viewBox for sizing |
| `FIG_RE` | `Fig\s+(\d+\.\d+)` | Scans the 500 chars *after* each SVG to find its caption/number |

`ensure_namespaces(svg)` splices `xmlns` / `xmlns:xlink` in right after the literal
`<svg` (only if absent) — inline course SVGs omit the namespace, and cairosvg needs it
to parse them standalone. The actual render is:

```python
cairosvg.svg2png(bytestring=svg.encode("utf-8"),
                 write_to=str(png),
                 output_width=int(round(viewBox_width * SCALE)),
                 background_color="white")
```

**Output:** `rendered/{stem}_svg{NN}.png` per SVG plus `rendered/manifest.json` — an
array of per-SVG records (`name, file, index, figure, viewBox, out_width, out_height,
png, status`). Default output dir is `ROOT/rendered` (git-ignored), overridable with
`--out DIR`.

### 3.4 Gate semantics

Each render is wrapped in try/except. A failure is recorded as
`status = "ERROR: {exc}"` and appended to an `errors` list — **rendering continues for
all other SVGs** (no fail-fast, so one bad figure doesn't hide the state of the rest).
At the end the script prints a per-file summary, writes the manifest, prints a total,
and:

> **if any error occurred, it prints the errors and `sys.exit(1)`.**

That non-zero exit *is* the gate. A course diagram edit cannot be called done while
this script is red.

---

## 4. `render_sim_views.py` — the simulator's arm of the same gate

The simulator generates SVG views dynamically (`out/*.svg` from the `render`, `url`,
`author`, and `scene` verbs). Those need the same rasterize-and-gate treatment, so
`render_sim_views.py` is a deliberate parallel to `render_diagrams.py`.

**Invocation:**

```
uv run tools/render_sim_views.py --selftest              # G0: trivial SVG -> non-empty PNG
uv run tools/render_sim_views.py out/topdown.svg out/controls.svg
uv run tools/render_sim_views.py --out /tmp/png out/*.svg
```

**Key design decision — it does NOT re-implement the libcairo bootstrap.** It simply
does `import render_diagrams` purely for the *side effect*: importing that module
triggers its top-level re-exec-once block, so `DYLD_FALLBACK_LIBRARY_PATH` is set and
the process re-execs (argv preserved) before this script's own logic runs. It also
reuses `render_diagrams.SCALE`, `render_diagrams.VIEWBOX_RE`, and
`render_diagrams.ensure_namespaces` directly rather than duplicating them. This shared
bootstrap / scale / namespace-fix is tracked as a formal design item in the simulator's
own docs (a code comment references "DESIGN §11, §12 G0; risk R-13"). The upshot: both
subsystems share **one bootstrap, one scale convention, one namespace fix, and one
exit-code contract**, while each owns its own input surface (static chapter HTML vs.
dynamically generated simulator SVG).

**The `--selftest` (gate "G0") fixture** rasterizes a trivial SVG (a green path over a
pale-green rect) to `simulator/out/_selftest.png` and asserts the libcairo bootstrap
actually works end-to-end:

- exception during rasterize → return 1, stderr `"SELFTEST FAIL: cairosvg raised: …"`
- resulting PNG has zero size → return 1, `"SELFTEST FAIL: PNG is empty"`
- otherwise → `"SELFTEST OK: libcairo bootstrap works; {png} ({size} bytes)"`, return 0

**Gate semantics** are the same shape as `render_diagrams.py`: per-file try/except,
error count accumulated, `sys.exit(1)` if any errors, else 0. Without `--out`, each SVG
rasterizes next to itself (`src.with_suffix(".png")`); with `--out DIR`, into
`DIR/{stem}.png`. Unlike `render_diagrams.py`, **no `manifest.json` is produced here**.

---

## 5. The render-then-vision-judge loop (and why it exists)

The render gate proves an SVG *renders*. It does not prove the picture *teaches the
right thing*. That second axis is why the project mandates a vision judge on top of the
gate.

### 5.1 Why the gate alone is insufficient

The failure the vision judge exists to catch is a picture whose coordinates are
arithmetically correct but which reads wrong to a human eye:

- an arrow whose endpoint sits mathematically fine but visually spills off the asphalt
  into the grass;
- a line labelled "good" that, at the drawn scale, visually appears to run wide;
- a callout anchored to a coordinate that turns out to be empty space.

A renderer that exits 0 says nothing about any of these. Only looking at the raster does.

### 5.2 The loop as practiced

1. Edit a course SVG, or generate a simulator SVG view (`out/*.svg` from a `moto-sim`
   verb).
2. Run the matching render gate — `render_diagrams.py <file>` (course) or
   `render_sim_views.py <svg…>` (simulator). **It must exit 0.** A non-zero exit blocks
   the loop mechanically; this is enforced, not merely convention.
3. Read the resulting PNG(s) with vision-capable tooling (or view in a browser via the
   `gstack` skill) and judge against `STANDARD.md`'s **two-axis test**: physical
   plausibility *and* doctrinal correctness.
4. **Mandatory delegation to a separate subagent.** `CLAUDE.md` states the rule
   flatly: *"Any edit to a figure must be visually verified by a subagent — never trust
   the author's own eyeball."* The subagent's job is exactly: (a) re-render the touched
   figure, (b) read the PNG with vision tools, (c) judge it against `STANDARD.md` — 
   confirming each line stays on the road surface, touches the edges it is supposed to,
   runs wide *only* where a mistake is being taught, and matches its caption and labels.
5. **The subagent's visual verdict — not the arithmetic — is the gate for "done."**

This rule has provenance: it entered `CLAUDE.md` in commit `c256940` ("Fix Fig 5.2/5.4
runs wide; add the subagent visual-verify rule"), i.e. it was born from a real case
where geometrically-plausible lines read as running wide.

### 5.3 The two-axis test and the colour code

`STANDARD.md`'s two axes are **physical plausibility** and **doctrinal correctness**.
The doctrine is encoded in a colour law the judge checks against:

- **green** = good / ideal line,
- **amber** = geometric / middling,
- **red** = the mistake being taught.

The ideal line is a **single smooth-arc, late-apex, outside–inside–outside** path.
The apex is *emergent*, never drawn as an input (doctrine rule #5).

### 5.4 How scene-baking shrinks Axis A

A key insight recorded in `PROPOSAL-scenes.md`: compiling figures from `.scene` files
(where the line comes out of the physics engine, not a hand-drawn polyline) makes
**Axis A (physical plausibility) true by construction**. The line is on the road and
physically feasible because the engine put it there. The vision subagent's job then
*shrinks* to Axis B spot-checks and legibility — "minutes instead of the 108-figure
audit treadmill." The verification philosophy inverts: instead of auditing every
hand-drawn line for physical plausibility, you author from physics and only check that
the picture is legible and on-message.

---

## 6. The test suite and its tripwires

The simulator carries **489 tests across 36 `*.test.mjs` files** (grown from 243 at v1,
through 387 at S2, 433 at S3, 461 at S4, to 489 at S5 final). Beyond ordinary unit
tests it contains two categories of **tripwire** — tests whose entire purpose is to
fail loudly when something that must never drift, drifts.

### 6.1 The dev test runner

`node simulator/cli.mjs test [substr]` is the project's own gate-friendly runner. It
enumerates `tests/*.test.mjs` (never via a shell glob — Node treats a bare dir arg as a
script path), optionally filters by basename substring, and spawns
`node --test --test-reporter=tap`. It parses the aggregate TAP summary and emits
`{ok, tests, pass, fail, duration_ms}` JSON, exit 0 all-green / 3 on any failure (same
tier as the doctrine gate). Crucially it **strips `NODE_TEST_CONTEXT` from the child
environment** — because this verb can be invoked *by* the suite it enumerates
(self-hosting), and without stripping the var the child would detect it's inside a
parent test run and switch to "child-reporter" mode, silently losing the TAP summary
this verb needs to parse. This runner was added in phase S0.5 specifically to fix an
ergonomics gap ("no working dev-test-runner incantation").

### 6.2 Tripwire 1 — preset-hash byte-stability

`tests/preset-hashes.test.mjs` recomputes `spec_hash` and `result_hash` for every
registered preset and every `simulator/scenarios/*.json` file, using **the same
loaders** that the bless script `bless-preset-hashes.mjs` uses (so the check path and
the bless path can never drift apart), and asserts equality against the committed
`tests/fixtures/preset-hashes.json`.

**What it protects:** any change to physics output. A hash mismatch outside a
deliberate, dedicated re-bless commit is a test failure. This is the mechanism that
made three significant changes *provably non-regressive* to existing physics output:

- the S0 float-rounding change (`roundForEmit`),
- the S1 taper-segment addition to `core/road.js` (added as an additive branch;
  the gate asserted every existing preset hash stayed byte-identical),
- the **8.2× solve speedup** (a windowed LUT lookup in `core/`; fuzzed with 0
  mismatches, and the hash tripwire confirmed byte-identical output).

The **byte-stability contract** (from `PLAN-scenes.md`): phases must not change any
existing preset's `spec_hash`/`result_hash` *except* in a dedicated re-bless commit.
Goldens re-bless exactly once, never silently.

### 6.3 Tripwire 2 — scene-golden round-trip & idempotent stamping

`tests/scene-stamp.test.mjs` (with `tests/scene.test.mjs` etc.) pins the
`scene --stamp` pipeline by driving **the real `cli.mjs` binary** — not unit-testing
internals — against a synthetic fixture `tests/fixtures/fake-chapter.html` that mimics
real course figure structure. (The committed course chapters are deliberately never
touched by these tests.) It asserts:

- guard-pair introduction + stamp on `--init-guards --replace-svg <NN>`;
- **byte-identical re-stamp** — the idempotence gate stated in `CLAUDE.md`: "re-bake
  must diff empty";
- caption lead-in preserved (the `<strong>…</strong>` verbatim) while the body swaps;
- sibling figures outside the guards untouched;
- plain `--stamp` **refuses** (exit 2) when guards are absent or unpaired;
- the stamped chapter still passes `render_diagrams.py`.

**What it protects:** the scene→SVG→chapter bake/stamp path, which writes into
committed course HTML. Idempotence is the invariant — re-baking a `.scene` and
re-stamping must produce zero diff, which is what makes the pipeline safe to re-run.

The related bless script is `bless-scene-goldens.mjs`; the fixtures live in
`tests/fixtures/`.

---

## 7. The audit-doc-as-fix-list working style

The project runs on an **audit-driven loop**. Each audit document is explicitly *"a fix
list consumed by the next loop"* (per `CLAUDE.md`) — a living worklist, not a static
report. There are two standing audits.

### 7.1 `line-diagram-audit.md` — geometry/doctrine audit

Covers all 108 figures against the two-axis test (physical plausibility + doctrinal
correctness per Ch. 8). Headline verdict: the diagrams are **sound**; only cosmetic
legibility items remained, and those were burned down (label-collision fixes to Figs
3.1, 8.3, 8.5, 9.6). It keeps some items as *commentary, not fixes* — e.g. Fig 14.8's
red loops are a **deliberate** mistake demonstration (not a defect), and the `□` glyphs
in some rendered PNGs are a cairosvg font-fallback for arrow/circle glyphs
(U+2192/U+25CB) — cosmetic only; browsers render them fine.

Since phase S5f the audit carries a **provenance column** — `hand` vs `scene:<file>` —
recording, for every figure, whether it is a hand-authored SVG or compiled from a
`.scene`. It lists the 13 scene-baked figures and, importantly, the **17 figures
evaluated and *blocked* from scene migration**, each with its specific physics-grounded
gap reason (e.g. "increasing taper unrideable", "concentric-arc primitive", "lone
linked line renders red"). Recording *why a figure could not be migrated* is treated as
first-class output, not a gap to paper over.

### 7.2 `content-fidelity-audit.md` — factual/metric audit

A 16-agent fan-out extracted ~362 checkable claims across the chapters and verified
each against the book text (from `extract_book.py` output) for doctrine and against
independent Python recomputation for numbers/physics. **Every flag got an adversarial
second pass** — and about half the first-pass flags were refuted. 16 confirmed issues
survived (H1–H2 high, M1–M5 medium, L1–L9 low), each tagged by class: `[metric]`
(leftover imperial values), `[self-consistency]` (contradicts the course's own
figure/formula), `[book]` (conflicts with *Total Control*), `[geometry]`
(label-vs-drawn-SVG mismatch), `[attribution]` (external-source precision). Bottom
line: the teaching is trustworthy; the fixes are a precision pass, the biggest cluster
being imperial leftovers in quiz text and `aria-label`s that an earlier
metric-conversion sweep missed. The verification pass itself caught 6 more
audit-missed items — cross-chapter "twin" errors — which surfaced a standing
"audit completeness: cross-chapter twins" follow-up now baked into the loop.

### 7.3 `NEEDS_IMPROVEMENT.md` — the ergonomics friction list

A companion working doc: *"a developer/agent-ergonomics list, not a bug list,"* written
by the agent that built the simulator v1, ordered by iteration cost. Its 14 items are
tiered, and most have since been resolved across phases S0–S4 (inverse-solve mode,
`diagnosis` on non-clean verdicts, `d`/`f` on trajectory samples, corner-relative
anchors, the mistake compiler's one-perturbation rule, the `exag` knob). One item is
explicitly kept **OPEN and flagged "Do NOT fix casually"** — #14, a lone non-clean
"good" line rendering RED — because `figure.mjs`'s output is baked into 13 committed
course SVGs, so any colour-rule change would require a deliberate re-bless commit
re-rendering and re-vision-judging every affected figure. This is the audit-loop
discipline turned on the tooling itself: a known defect is left documented rather than
"fixed casually" in a way that would silently invalidate committed, vision-signed-off
artifacts.

---

## 8. Tests before code

The house rule (from the user's global instructions) is **tests before code**: write
the test, then the implementation; prefer tests that are educational and convey real
usage; and specifically add tests for behaviours that *would fail silently in
production*, rather than tests written only for coverage. The two tripwires in §6 are
exactly this philosophy applied — they exist because a physics-output drift or a
non-idempotent scene stamp is precisely the kind of failure that produces no error, no
crash, and no obvious symptom, and would otherwise reach a committed course chapter
unnoticed.

The simulator's dev test runner (§6.1) is deliberately kept a **separate leg** from the
render/vision check rather than folded into it — the test suite proves the *engine* is
correct; the render gate plus vision judge prove the *picture* is correct; and the
hash/golden tripwires prove *nothing silently drifted*. Three orthogonal proofs, each
run independently, are what let this project claim a piece of work is done instead of
merely asserting it.

---

## 9. Quick reference — gate commands and their exit contracts

| Command | Exit-0 means | Non-zero means |
|---|---|---|
| `uv run tools/render_diagrams.py [files…]` | every course SVG rasterized | `1` = at least one SVG failed to render |
| `uv run tools/render_sim_views.py <svg…>` | every simulator SVG rasterized | `1` = at least one view failed |
| `uv run tools/render_sim_views.py --selftest` | libcairo bootstrap works, PNG non-empty | `1` = cairosvg raised or PNG empty |
| `node simulator/cli.mjs test [substr]` | all tests green | `3` = one or more tests failed |
| `node --test "simulator/tests/"*.test.mjs` | all 489 tests pass | test framework non-zero on any failure |

In every case the non-zero exit is the *mechanical* gate. On the diagram side, passing
that gate is **necessary but never sufficient** — the vision subagent's verdict against
`STANDARD.md` is the final word on whether a figure is done.
