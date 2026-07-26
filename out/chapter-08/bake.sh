#!/bin/bash
# Re-bake all six Chapter 8 figures from the scene sources, render every view,
# copy the committed artefacts into this directory, and rebuild the gallery.
#
#   bash out/chapter-08/bake.sh          (or: cd linelab && npm run bake:ch8)
#
# Everything is derived from this script's own location — no absolute paths, no
# state in /tmp. The scratch bake lands in ./.bake (git-ignored); only the SVGs,
# manifests, envelopes, verdicts.json and gallery.html are committed.
#
# The POV pass runs once PER LINE (`render --views pov --line <id>`), so a plate
# can put the ideal rider's frame beside the mistake rider's frame at the same
# corner instead of showing one frame with nothing to compare it to.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
LAB="$ROOT/linelab"
SCENES="$ROOT/figures"
BAKE="${CH8_BAKE_DIR:-$HERE/.bake}"
CLI="$LAB/dist/cli/main.js"

failures=0
deviations=0
note_exit() { # <label> <status>
  echo "$1 exit=$2"
  [ "$2" -eq 0 ] || failures=$((failures + 1))
}
# `figure` returns tier 3 (DEVIATION) when a line's emergent verdict differs
# from the gate's derived expectation — fig 8.5 and 8.6's ideal lines grade
# `caution` on the linking corner, a known engine seam (test/golden/scenes.ts).
# That is a finding to surface, not a broken bake: the envelope still wrote.
note_figure_exit() { # <label> <status>
  if [ "$2" -eq 3 ]; then
    echo "$1 exit=3  DEVIATION (gate expectation unmet — envelope still written)"
    deviations=$((deviations + 1))
  else
    note_exit "$1" "$2"
  fi
}

# dist/ is what the CLI runs from; a stale build silently bakes the old renderer.
if [ "${CH8_SKIP_BUILD:-0}" != "1" ]; then
  (cd "$LAB" && npm run --silent build)
  note_exit "build" $?
fi

for n in 01 02 03 04 05 06; do
  id="fig-08-$n"
  rm -rf "$BAKE/$id" "$BAKE/views-$n" "$BAKE/stations-$n"
  mkdir -p "$BAKE/$id" "$BAKE/views-$n" "$BAKE/stations-$n"
  rm -f "$HERE/$id".*.turnin.pov.svg "$HERE/$id".*.apex.pov.svg "$HERE/$id".*.exit.pov.svg

  node "$CLI" figure "$SCENES/$id.scene" --mode true --out "$BAKE/$id" \
    > "$BAKE/$id.stdout.json" 2> "$BAKE/$id.stderr"
  note_figure_exit "$id figure" $?

  env="$BAKE/$id/$id.json"
  node "$CLI" render "$env" --views topdown,controls --mode true --out "$BAKE/views-$n" \
    > "$BAKE/render-$n.json" 2>&1
  note_exit "$id topdown+controls" $?

  # POVs: one per drawn line — the comparison IS the view — and one per station
  # within each line. A single frame is a picture; three frames at the turn-in,
  # the apex and the exit are the corner as the rider met it. The stations are
  # the line's OWN recorded events, so a line that never apexed contributes no
  # apex frame rather than a fabricated one.
  for pair in $(node -e "
    const e = require('$env');
    const v = e.value ?? e;
    const out = [];
    for (const l of (v.lines ?? []).filter(l => l.ok !== false || !l.error)) {
      const ev = (l.trajectory?.events ?? []);
      const first = (k) => ev.filter(x => x.kind === k).map(x => x.s).sort((a,b) => a-b)[0];
      const last  = (k) => ev.filter(x => x.kind === k).map(x => x.s).sort((a,b) => b-a)[0];
      const stations = { turnin: first('turn_in'), apex: first('apex'), exit: last('exit') };
      for (const [tag, s] of Object.entries(stations)) {
        if (s !== undefined) out.push(l.line_id + ':' + tag + ':' + Math.round(s));
      }
      out.push(l.line_id + ':default:');
    }
    console.log(out.join(' '));
  "); do
    line=${pair%%:*}
    rest=${pair#*:}
    tag=${rest%%:*}
    station=${rest#*:}
    if [ "$tag" = "default" ]; then
      node "$CLI" render "$env" --views pov --line "$line" --mode true --look limit_point --roll level \
        --out "$BAKE/views-$n" > "$BAKE/pov-$n-$line.json" 2>&1
      note_exit "  $id pov --line $line" $?
    else
      node "$CLI" render "$env" --views pov --line "$line" --mode true --look limit_point --roll level \
        --s "$station" --out "$BAKE/stations-$n" > "$BAKE/pov-$n-$line-$tag.json" 2>&1
      note_exit "  $id pov --line $line @$tag (s=$station)" $?
      # station frames take the EVENT's name, not its metre mark: the reader
      # thinks "at the apex", never "at s = 24"
      mv "$BAKE/stations-$n/$id.$line.s$station.pov.svg" "$HERE/$id.$line.$tag.pov.svg" 2>/dev/null
    fi
  done

  # The committed artefacts. The top-down and its manifest come from the FIGURE
  # verb, not from `render`: only the figure verb sees the scene, so only its
  # render carries the scene's `marks:` selection and `labels:` callouts, and
  # only its manifest carries the real spec_hash. `render` re-renders from the
  # envelope, which has neither — it exists here for the per-line controls and
  # POV strips. Copying the wrong one silently drops every callout.
  cp "$BAKE/$id/$id.svg" "$HERE/$id.svg"
  cp "$BAKE/$id/manifest.json" "$HERE/$id.manifest.json"
  cp "$BAKE/views-$n"/*.controls.svg "$BAKE/views-$n"/*.pov.svg "$HERE/"
  cp "$env" "$HERE/$id.envelope.json"
done

node "$HERE/summarize.mjs" "$BAKE" > "$BAKE/summary.json"
note_exit "summarize" $?
cp "$BAKE/summary.json" "$HERE/verdicts.json"

CH8_BAKE_DIR="$BAKE" node "$HERE/build-gallery.mjs"
note_exit "gallery" $?

if [ "$failures" -ne 0 ]; then
  echo "bake FAILED: $failures step(s) non-zero"
  exit 1
fi
echo "bake ok ($deviations figure deviation(s))"
