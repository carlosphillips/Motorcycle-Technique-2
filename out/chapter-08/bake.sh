#!/bin/bash
# Re-bake all six Chapter 8 figures from the scene sources, then render every
# view. The POV pass now runs once PER LINE (`render --views pov --line <id>`),
# so a plate can put the ideal rider's frame beside the mistake rider's frame at
# the same corner instead of showing one frame with nothing to compare it to.
set -u
LAB="/Users/carlos/Documents/Claude/Projects/Motorcycle Technique 2/linelab"
SCENES="/Users/carlos/Documents/Claude/Projects/Motorcycle Technique 2/figures"
BAKE=/tmp/ch8bake
CLI="$LAB/dist/cli/main.js"

cd "$LAB" || exit 1

for n in 01 02 03 04 05 06; do
  id="fig-08-$n"
  rm -rf "$BAKE/$id" "$BAKE/views-$n"
  mkdir -p "$BAKE/$id" "$BAKE/views-$n"

  node "$CLI" figure "$SCENES/$id.scene" --mode true --out "$BAKE/$id" \
    > "$BAKE/$id.stdout.json" 2> "$BAKE/$id.stderr"
  echo "$id figure exit=$?"

  env="$BAKE/$id/$id.json"
  node "$CLI" render "$env" --views topdown,controls --mode true --out "$BAKE/views-$n" \
    > "$BAKE/render-$n.json" 2>&1
  echo "$id topdown+controls exit=$?"

  # one POV per drawn line — the comparison IS the view
  for line in $(node -e "
    const e = require('$env');
    const v = e.value ?? e;
    console.log((v.lines ?? []).filter(l => l.ok !== false || !l.error).map(l => l.line_id).join(' '));
  "); do
    node "$CLI" render "$env" --views pov --line "$line" --mode true --out "$BAKE/views-$n" \
      > "$BAKE/pov-$n-$line.json" 2>&1
    echo "  $id pov --line $line exit=$?"
  done
done

node "$BAKE/summarize.mjs" > "$BAKE/summary.json"
echo "summary rewritten"
