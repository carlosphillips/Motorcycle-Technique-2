# Workflow templates for `next-steps`

Three shapes of work show up in this roadmap. Pick the closest one and adapt it — these
are starting points, not forms to fill in. Keep a run under ~15 agents unless the item
genuinely needs more.

All three share the same spine and the same reason for it: **the expensive failure here
is building something `figures/SCOPE.md` already killed, or building something the design
letter forbids.** Grounding is cheap; a wasted authoring pass is not.

Pass the chosen item in as `args` — a plain object like
`{id: 'S15', title: 'placard rendering', deliverables: [...], constraints: [...]}` — so
the script stays reusable and the plan file stays the single source of scope.

Contents:
- [Shared schemas](#shared-schemas)
- [1. Capability work](#1-capability-work) — an engine or render capability the roadmap gates on (S15)
- [2. Figure authoring](#2-figure-authoring) — author, bake, and attack a candidate figure
- [3. Adjudication sweep](#3-adjudication-sweep) — decide a large candidate set on merit

---

## Shared schemas

Reuse these across templates. The `schema` option forces a validated object back, which
is what lets the script branch on results instead of parsing prose.

```js
const GROUND = {
  type: 'object',
  required: ['summary', 'citations', 'blockers'],
  properties: {
    summary: { type: 'string', description: 'what this source establishes, in 3-6 sentences' },
    citations: {
      type: 'array',
      items: { type: 'string' },
      description: 'file + section/line for every claim, e.g. "design/06 §11" or "src/render/svg.ts:214"',
    },
    blockers: {
      type: 'array',
      description: 'anything that would stop the work, one entry each',
      items: {
        type: 'object',
        required: ['what', 'kind'],
        properties: {
          what: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['design-amendment', 'stop', 'engine-bug', 'none'],
            description: 'stop = only the design owner can decide it',
          },
        },
      },
    },
  },
}

const VERDICT = {
  type: 'object',
  required: ['refuted', 'reason'],
  properties: {
    refuted: { type: 'boolean', description: 'true if the claim does not hold' },
    reason: { type: 'string', description: 'the specific evidence, with file:line or a measured number' },
  },
}
```

---

## 1. Capability work

For roadmap items that are a missing capability the rest of the list gates on — S15
(nothing renders a placard) is the live example. The build is small; the risk is
building it against the wrong reading of the design letter.

The barrier after `Ground` is deliberate: the build agents need all three grounding
reports together, and if grounding turns up a `stop` the run must not start building.

```js
export const meta = {
  name: 'next-steps-capability',
  description: 'Ground, build and adversarially verify a gating capability from ROADMAP NEXT',
  phases: [
    { title: 'Ground', detail: 'design letter vs shipped engine vs prior kills' },
    { title: 'Build', detail: 'one agent per deliverable' },
    { title: 'Verify', detail: 'independent skeptics attack each claim' },
  ],
}

const ITEM = args

phase('Ground')
const [letter, engine, history] = await parallel([
  () => agent(
    `Read design/00-09. For "${ITEM.title}": what does the design of record REQUIRE — ` +
    `exact wording, section numbers, and any place two sections disagree? ` +
    `Do not read src/. The letter outranks the code; report the letter.`,
    { label: 'ground:letter', schema: GROUND }),
  () => agent(
    `Read linelab/src/**. For "${ITEM.title}": what does the shipped engine do TODAY? ` +
    `Trace the actual data path end to end and name where it stops. Cite file:line. ` +
    `Report behaviour, not intent — do not infer from names or comments.`,
    { label: 'ground:engine', schema: GROUND }),
  () => agent(
    `Read figures/SCOPE.md §3-§4 and linelab/DEVIATIONS.md. Has "${ITEM.title}" been ` +
    `attempted before? What killed it, and is that cause still live? List every STOP ` +
    `that names it. Being thorough here saves a whole authoring pass.`,
    { label: 'ground:history', schema: GROUND }),
])

const stops = [letter, engine, history].filter(Boolean)
  .flatMap(g => g.blockers).filter(b => b.kind === 'stop')
if (stops.length) {
  log(`STOP-blocked: ${stops.map(s => s.what).join('; ')}`)
  return { blocked: true, stops, ground: { letter, engine, history } }
}

const context =
  `DESIGN REQUIRES:\n${letter.summary}\nCITATIONS: ${letter.citations.join(', ')}\n\n` +
  `ENGINE DOES:\n${engine.summary}\nCITATIONS: ${engine.citations.join(', ')}\n\n` +
  `HISTORY:\n${history.summary}`

phase('Build')
const built = await pipeline(
  ITEM.deliverables,
  (d, _item, i) => agent(
    `${context}\n\nImplement: ${d}\n\n` +
    `Rules that are not negotiable: never weaken a check, threshold, golden or test to ` +
    `go green; never change engine behaviour to make a figure pass; zero runtime ` +
    `dependencies. Write the tests first. If the design letter does not authorize what ` +
    `you need, stop and report it as a design-amendment blocker rather than improvising.`,
    { label: `build:${i}`, phase: 'Build', isolation: ITEM.parallelEdits ? 'worktree' : undefined,
      schema: { type: 'object', required: ['claim', 'files', 'tests'],
        properties: {
          claim: { type: 'string', description: 'what now works that did not before' },
          files: { type: 'array', items: { type: 'string' } },
          tests: { type: 'array', items: { type: 'string' }, description: 'test names added' },
        } } }),
  (b) => b && parallel(['correctness', 'design-conformance', 'does-it-actually-render']
    .map(lens => () => agent(
      `${context}\n\nClaim: "${b.claim}" (files: ${b.files.join(', ')})\n\n` +
      `Try to REFUTE this through the ${lens} lens. Verify against the built artifact ` +
      `itself, not the diff — for a render claim that means reading the emitted SVG. ` +
      `Default to refuted:true if you cannot confirm it.`,
      { label: `verify:${lens}`, phase: 'Verify', schema: VERDICT })))
    .then(vs => ({ ...b, votes: vs.filter(Boolean),
                   survives: vs.filter(Boolean).filter(v => !v.refuted).length >= 2 })),
)

const results = built.filter(Boolean)
return {
  shipped: results.filter(r => r.survives),
  refuted: results.filter(r => !r.survives),
  ground: { letter, engine, history },
}
```

After this returns, run the gates yourself — `npm run build && npm run typecheck &&
npm test`, then `npm run bake:ch8` twice with a clean `git status` on the second.

---

## 2. Figure authoring

For candidates in the roadmap's numbered table (`chop` on `book90`, the `overread` timid
line, the check-16 fail). These die more often on **disclosure** than on physics, so the
attack phase runs two distinct lenses — merit and disclosure — rather than three
identical skeptics.

`figures/SCOPE.md` §3 already contains baked scene text for several candidates. Feed it
in; re-deriving it is pure waste.

```js
export const meta = {
  name: 'next-steps-figures',
  description: 'Author, bake and attack candidate figures from the ROADMAP table',
  phases: [
    { title: 'Ground', detail: 'doctrine surface + prior attempt' },
    { title: 'Author', detail: 'scene + bake per candidate' },
    { title: 'Attack', detail: 'merit lens and disclosure lens' },
  ],
}

const CANDIDATES = args.candidates   // [{id, carrier, teaching, knownObstacle, priorSceneText}]

phase('Ground')
const doctrine = await agent(
  `Read design/01 §5 §8 §A.2, design/04 §4 (scene grammar), figures/*.scene, and ` +
  `figures/SCOPE.md §3. Report: the exact scene grammar available today, the closed set ` +
  `of mistake kinds, and for each of these carriers ${CANDIDATES.map(c => c.carrier).join(', ')} ` +
  `whether it has EVER graded non-pass on a committed line. The carrier rule (S27) says ` +
  `a check cannot carry a figure until it is shown capable of a non-pass verdict on that road.`,
  { label: 'ground:doctrine', schema: GROUND })

phase('Author')
const judged = await pipeline(
  CANDIDATES,
  (c) => agent(
    `Scene grammar and carrier evidence:\n${doctrine.summary}\n\n` +
    `Author figure "${c.id}". Carrier: ${c.carrier}. Teaching: ${c.teaching}\n` +
    `Known obstacle from the roadmap: ${c.knownObstacle}\n` +
    (c.priorSceneText ? `Prior baked scene text — start here:\n${c.priorSceneText}\n` : '') +
    `\nWrite the .scene, bake it with dist/cli/main.js figure, and report the ACTUAL ` +
    `check rows from the envelope. G1: every line must be solved, never authored. ` +
    `If the carrier grades na or passes on every line, say so and stop — that is the ` +
    `figure failing, not you.`,
    { label: `author:${c.id}`, phase: 'Author',
      schema: { type: 'object', required: ['id', 'baked', 'checkRows', 'carrierVerdict'],
        properties: {
          id: { type: 'string' },
          baked: { type: 'boolean' },
          sceneText: { type: 'string' },
          checkRows: { type: 'string', description: 'the actual verdict rows from the envelope' },
          carrierVerdict: { type: 'string', description: 'pass | warn | fail | na' },
        } } }),
  (f, c) => f && f.baked && parallel([
    () => agent(
      `Figure ${c.id}. Check rows: ${f.checkRows}\n\n` +
      `MERIT LENS. Does this figure teach anything the six shipped figures do not? ` +
      `Is the carrier's verdict a real differential, or a knife-edge on a tuning ` +
      `constant? Is the fail set byte-identical to an existing figure's? Refute it.`,
      { label: `attack:merit:${c.id}`, phase: 'Attack', schema: VERDICT }),
    () => agent(
      `Figure ${c.id}. Scene:\n${f.sceneText}\n\n` +
      `DISCLOSURE LENS. If this illustrates prose rather than reproducing a printed ` +
      `diagram, does the ARTIFACT say so — in the SVG a reader actually sees, not just ` +
      `meta.caption? Read the emitted SVG. A figure whose disclaimer reaches nobody is ` +
      `the plausible fake design/01 §8 refuses. Refute it.`,
      { label: `attack:disclosure:${c.id}`, phase: 'Attack', schema: VERDICT }),
  ]).then(vs => ({ ...f, votes: vs.filter(Boolean),
                   survives: vs.filter(Boolean).every(v => !v.refuted) })),
)

const out = judged.filter(Boolean)
return { shipped: out.filter(f => f.survives), killed: out.filter(f => !f.survives) }
```

Note the asymmetry: a figure ships only if **both** lenses clear it. Merit and disclosure
are independent necessary conditions — an honest figure nobody can tell is honest still
doesn't ship.

---

## 3. Adjudication sweep

For deciding a large candidate set — the shape the 81-figure corpus pass used. Reach for
it when the roadmap item is a question ("is there anything else we can grade honestly?")
rather than a build.

Two things that pass learned the hard way, both worth keeping:

- **Adjudicators told to "prefer OUT when torn" produce a biased set.** Run a steelman
  afterwards on the closest refusals, defending them at full strength. Last time it moved
  zero verdicts, which is exactly what made the result trustworthy.
- **Reconcile the count.** Every candidate must land in exactly one bucket, and the
  buckets must sum to the input. That arithmetic is what turns "we looked at a lot" into
  a result.

```js
export const meta = {
  name: 'next-steps-adjudicate',
  description: 'Adjudicate a candidate set, then steelman the closest refusals',
  phases: [
    { title: 'Adjudicate', detail: 'one agent per batch' },
    { title: 'Steelman', detail: 'defend the closest refusals at full strength' },
  ],
}

const BATCHES = args.batches   // [[candidate, ...], ...] — keep each batch small enough to reason about

phase('Adjudicate')
const verdicts = (await parallel(BATCHES.map((b, i) => () => agent(
  `Adjudicate these against design/01 §8 (what linelab refuses) and the engine's actual ` +
  `capabilities: ${JSON.stringify(b)}\n\n` +
  `For each: IN or OUT, the specific ground, and which design section carries it. ` +
  `Prefer OUT when torn — a defence pass runs afterwards, so a wrong OUT is recoverable ` +
  `and a wrong IN is not.`,
  { label: `adjudicate:${i}`, schema: {
    type: 'object', required: ['verdicts'],
    properties: { verdicts: { type: 'array', items: {
      type: 'object', required: ['id', 'verdict', 'ground', 'closeness'],
      properties: {
        id: { type: 'string' },
        verdict: { type: 'string', enum: ['IN', 'OUT'] },
        ground: { type: 'string' },
        closeness: { type: 'integer', description: '0 = clear-cut, 3 = nearly went the other way' },
      } } } } } })))).filter(Boolean).flatMap(r => r.verdicts)

phase('Steelman')
const closest = verdicts.filter(v => v.verdict === 'OUT' && v.closeness >= 2)
const defended = await parallel(closest.map(v => () => agent(
  `${v.id} was refused on: ${v.ground}\n\n` +
  `Defend it at full strength. Build the strongest honest case for IN. If the refusal ` +
  `survives your best argument, say so and name which of its grounds you refuted along ` +
  `the way — a refusal that stands on three of four grounds is a better record than one ` +
  `that stands unexamined.`,
  { label: `steelman:${v.id}`, schema: {
    type: 'object', required: ['overturned', 'argument'],
    properties: {
      overturned: { type: 'boolean' },
      argument: { type: 'string' },
      groundsRefuted: { type: 'array', items: { type: 'string' } },
    } } })))

log(`${verdicts.length} adjudicated, ${closest.length} steelmanned, ` +
    `${defended.filter(Boolean).filter(d => d.overturned).length} overturned`)
return { verdicts, steelman: defended.filter(Boolean) }
```

Report the reconciliation explicitly in `ROADMAP.md`: *N adjudicated = X in + Y out*, and
the bucket breakdown. Read the "extend past Chapter 8" section for the register — it is
the model for how a zero-result pass gets written up as a settled question rather than a
failure.
