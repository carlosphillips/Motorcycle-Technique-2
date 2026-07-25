# Chapter 8 figure bake — 2026-07-25

Generated output from `linelab` for all six Chapter 8 book figures. Every file here
was produced by the engine; nothing was hand-edited.

Open `gallery.html` in a browser for all six figures with their scene sources, five
views each, the graded verdict behind them, a symbol legend, and an analysis of what
the twelve graded lines say when read together. The `.svg` files open directly in
any browser or Preview.

## Reproducing

`bake.sh` runs the whole thing. Per figure that is one `figure` call, one `render`
for the top-down and control strips, and one `render` **per line** for the POV:

```sh
node dist/cli/main.js figure ../figures/fig-08-01.scene --mode true --out out/fig-08-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json \
     --views topdown,controls --mode true --out views-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json \
     --views pov --line good --mode true --out views-01
node dist/cli/main.js render out/fig-08-01/fig-08-01.json \
     --views pov --line bad  --mode true --out views-01
```

`figure` produces the top-down book figure, the envelope, and the manifest.
`render` re-renders an existing envelope without re-solving, and is the only way
to get the POV and controls views.

Bake exit codes: `0` for figs 8.1–8.4, `3` for 8.5 and 8.6. A `3` is the
declaration gate reporting that the scene contains intentionally failing lines —
it is the expected result for those two figures, not an error.

## What is here

| File pattern | View | Produced by |
|---|---|---|
| `fig-08-0N.svg` | top-down book figure | `figure` |
| `fig-08-0N.<line>.pov.svg` | first-person view from THAT line's saddle | `render --views pov --line <line>` |
| `fig-08-0N.<line>.controls.svg` | control/state strip per line | `render --views controls` |
| `fig-08-0N.manifest.json` | proportion-gate metrics, legend, spec hash | `figure` |
| `fig-08-0N.envelope.json` | full solved envelope (road, samples, verdict, checks) | `figure` |
| `verdicts.json` | condensed per-line verdict summary across all six | derived |
| `gallery.html` | self-contained browsable page embedding every view | `build-gallery.mjs` |
| `bake.sh` | the whole bake, end to end | — |

The top-down SVGs are **byte-identical** to the committed
`linelab/figures/fig-08-0*.svg`, verified with `cmp` at save time.

## Three things to know when reading these

**POV is rendered per line, and the pair is the point.** `render --views pov`
without `--line` still writes one frame focused on the ideal line, which is a
picture with nothing to compare it to. `--line <id>` focuses one line and names the
output `<figure_id>.<line_id>.pov.svg`, matching how `controls` has always spelled
its per-line files. The camera pose is each line's OWN recorded `Sample`, so the two
frames are the same corner seen from where each rider's own line put them. On
figure 8.1 that is worth 19.1 m of sight: the ideal line sees 26.6 m with 19.2 m of
stopping distance needed; the premature turn point sees 7.4 m and needs 18.3 m.

**The top-down view must come from `figure`, not `render`.** A scene's `labels:`
and `marks:` are figure-spec data that the envelope does not carry, so the
`render` verb's top-down output silently omits the book callouts ("premature turn
point", "late apex — sight and exit"). The files here are the `figure` output,
which includes them.

**The proportion gate reads `fail`/`warn` on most figures, and fig 8.6 is
landscape.** Both follow from `--mode true`, which design/06 §2.1 defines as the
identity transform — literal metric proportion and no frame rotation, so the
`orient=90` that fig 8.6's scene authors is recorded in the manifest but not
applied. The gate measures page composition, not physics; the geometry is
correct. Diagram-mode compression, which is what would satisfy the gate and apply
the rotation, is deferred past v1.0 and recorded in `linelab/DEVIATIONS.md`.
The portrait PNGs in `linelab/figures/png/` were rotated downstream, not by the
engine.

## Figure 8.5 was rebuilt in this bake

The scene previously asked for `good: ride entry=30 style=double_apex` and got a
typed `NO_SOLUTION / no_two_touch_line` refusal, so the plate had no ideal line at
all; its mistake line was a `believeRoad` under-read, which teaches road-reading
rather than apex placement. The figure now reads:

```
good:    ride entry=30 turnIn=auto
early:   mistake premature
```

`early` is the early apex — `premature` is the kind D25 renamed from `early_apex`.
It turns in 10 m sooner, touches the inside of c1 at 51 % of sweep, and then runs
wide in c2 and off the outside edge before c3 exists, with the corrective shot
infeasible (`departed_before_reaction`).

The two-touch solver still refuses on this road, and it refuses at **every entry
speed probed from 18 to 36 km/h** — so it is a solver capability gap, not a fact
about 30 km/h. `solve/doubleApex.ts`'s own header records the arithmetic: the
compound-window drift cannot widen the line back out to c2's inside edge
(`DA_MID_ACCEL = 1.0` delivers v² × 1.63 where × 1.92 is needed). That refusal is
a ratified design decision with a tripwire test, so the scene asks for the chained
line the engine can justify instead of a two-touch line it cannot.

That chained line grades `caution`, not `good`, and the reason is the lesson: the
corner-scoped doctrine reads the linking c2 as a corner in its own right and marks
its 5 %-of-sweep apex early. A line that apexes each corner in turn is already
compromised on a compound corner. It never leaves the corridor — no containment
check fails.

## The judge records were re-run for this bake

Changing fig-08-05's scene invalidated its `figures/fig-08-05.judge.json` record,
and re-pinning `verify/judge.json`'s `judge_model_version` from `claude-sonnet-5`
to `claude-opus-5` invalidated the other five, so all six were re-judged in one
ceremony (design/09 §7.4) on 2026-07-25. Verdict flips, exhaustively: fig-08-02 J3
`pass`→`na` and fig-08-06 J3 `pass`→`na` (neither scene declares any `labels:`, and
the prior records disagreed with each other on that same fact); fig-08-05's record
is wholly new. No other item on any figure changed. All six remain overall `pass`,
no item flaky. The full log is in `verify/judge.json` under `policy.re_judge_log`.

## Known defect, deliberately not fixed

`render/controls.ts` and the top-down renderer emit a line id as an element `id`
on every element belonging to that line — `id="good"` appears 8 times in a single
SVG, alongside the `data-line-id="good"` that already carries that information.
Duplicate IDs make the SVG technically invalid, though nothing references them
via `url()`, so rendering is unaffected.

It is left alone on purpose: changing renderer byte output would break the
committed goldens in `linelab/test/fixtures/goldens/` and the blessed hashes in
`design/02-physics-model.md §8.1`. `build-gallery.mjs` works around it by
uniquifying unreferenced ids when it inlines the SVGs.
