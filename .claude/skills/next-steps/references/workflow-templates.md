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
- [4. Substrate repair](#4-substrate-repair) — a rubric or renderer change that moves **committed** ink

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

const BUILT = {
  type: 'object',
  required: ['claim', 'files', 'tests'],
  properties: {
    claim: { type: 'string', description: 'what now works that did not before, in one sentence' },
    files: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' },
      description: 'test names added, and whether each was CONFIRMED RED before the fix' },
  },
}

// For template 4. Every field is a measurement, never an estimate — this object is what
// a STOP carries when the letter does not authorize the repair.
const BLAST = {
  type: 'object',
  required: ['linesFlipped', 'qualityMoves', 'hashesMove', 'testsAffected', 'verdict'],
  properties: {
    linesFlipped: { type: 'string', description: 'figure + line id + direction, exhaustively over the committed corpus' },
    qualityMoves: { type: 'string', description: 'does the quality word move — and so the drawn colour and terminal word (design/05 §6.1)' },
    hashesMove: { type: 'string', description: 'result_hash / spec_hash / committed SVG bytes' },
    testsAffected: { type: 'string', description: 'named tests and goldens needing re-bless' },
    verdict: { type: 'string', enum: ['small-fix', 'corpus-event', 'no-visible-change', 'unmeasurable'] },
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
      `MERIT + REMIT LENS. Does this figure teach anything the six shipped figures do ` +
      `not? Is the carrier's verdict a real differential, or a knife-edge on a tuning ` +
      `constant? Is the fail set byte-identical to an existing figure's? And is the ` +
      `carrier inside S12's Chapter-8-scoped grant — decide that from the pack's ` +
      `per-check book_ref and design/01 §4.3, never from the figure's filename. Refute it.`,
      { label: `attack:merit:${c.id}`, phase: 'Attack', schema: VERDICT }),
    () => agent(
      `Figure ${c.id}. Scene:\n${f.sceneText}\n\n` +
      `DISCLOSURE LENS. If this illustrates prose rather than reproducing a printed ` +
      `diagram, does the ARTIFACT say so — in the SVG a reader actually sees, not just ` +
      `meta.caption? Read the emitted SVG. A figure whose disclaimer reaches nobody is ` +
      `the plausible fake design/01 §8 refuses. Then take each rendered sentence and ask ` +
      `not "is it true" but "what does a student conclude, and does the envelope support ` +
      `THAT". Refute it.`,
      { label: `attack:disclosure:${c.id}`, phase: 'Attack', schema: VERDICT }),
    () => agent(
      `STRANGER LENS — follow this in order, do not skip ahead.\n` +
      `1. Open ONLY the rendered SVG at ${f.bakeDir}. Do not read the scene, the ` +
      `envelope, SCOPE.md or ROADMAP.md yet. Read it as a motorcyclist studying a ` +
      `diagram in a book would: someone who can ride and knows nothing about linelab.\n` +
      `2. BEFORE opening anything else, write down every factual belief you now hold — ` +
      `what the rider did, what it caused, what you would do differently. Include the ` +
      `inferences the ink only implies; those are the ones that matter.\n` +
      `3. NOW open the envelope and test each belief: supported, contradicted, or ` +
      `unsupported-either-way, with the JSON pointer.\n` +
      `4. refuted:true if ANY belief a reasonable rider would form from the ink alone is ` +
      `CONTRADICTED. An unsupported belief is a warning; a contradicted one is fatal — ` +
      `a plausible fake is exactly a figure whose reader concludes what the engine did ` +
      `not compute. Report your step-2 beliefs verbatim before the verdict.`,
      { label: `attack:stranger:${c.id}`, phase: 'Attack', schema: VERDICT }),
  ]).then(vs => ({ ...f, votes: vs.filter(Boolean),
                   survives: vs.filter(Boolean).length === 3 &&
                             vs.filter(Boolean).every(v => !v.refuted) })),
)

const out = judged.filter(Boolean)
return { shipped: out.filter(f => f.survives), killed: out.filter(f => !f.survives) }
```

Note the asymmetry: a figure ships only if **all three** lenses clear it. They are
independent necessary conditions — an honest figure nobody can tell is honest still
doesn't ship.

**The stranger lens earns its slot.** Added 2026-07-28 after it killed a figure that the
merit lens had cleared outright and that the disclosure lens killed on a *different*
ground. Merit and disclosure both read the scene first, so both inherit the author's
framing; the stranger is the only lens that measures what the artifact actually conveys.
It is also the only lens that catches claims made by things that are not sentences — in
its first outing it killed `fig-08-D4` on the *absence* of a marker, which no reading of
the placards could have surfaced.

Three more things this shape learned the hard way, all of which cost a round each:

- **A repair brief written from adversarial findings is not evidence.** Round 3's brief
  told the author to state a rate — "40 m/s³ against the 8 m/s³ bar" — and that wording
  would itself have been the next kill, because the ideal line *in the same figure* sits
  at −12 m/s³ against that bar and passes. If you hand an author a suggested repair,
  require them to verify it before adopting it, and treat its refutation as a finding.
- **A check's bar is often not its discriminator.** Sweep the parameter, then find the
  clause that actually separates the two lines — frequently a guard, not the threshold.
- **`selfRefused` must survive your post-processing.** `pipeline`'s later stages return
  falsy for a self-refused candidate, so a naive `.filter(Boolean)` deletes the most
  valuable result in the run. Collect self-refusals explicitly, or read them back out of
  `journal.jsonl`.

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

---

## 4. Substrate repair

For a defect **in a check, a threshold, or the renderer** — the shape of the `out_in_out`
cluster and S34. It is the only shape where doing the work correctly can turn *committed,
shipped, green* ink red, so it is the only shape with its own authorization step.

**Why the ordinary guardrails do not cover it.** "Never weaken a check to turn something
green" points the other way: these repairs turn things **red**. The hazard here is the
mirror image — *strengthening a check on your own authority and calling six shipped
figures wrong.* The discipline that replaces it:

> **Classify from the letter BEFORE you measure, and measure BEFORE you change anything.**
> Classifying after measuring is how a run talks itself into a corpus event, because a
> big blast radius makes a defect feel important. The order matters.

The authorization table. It is short, and it is the whole point of the template:

| letter says | committed ink moves | what you may do |
|---|---|---|
| decides it (**normative**, not commentary) | no | fix it, land it |
| decides it (**normative**) | yes | fix it, re-bake, re-judge, and write it up as a corpus event — **the letter outranks the corpus** (`design/00`–`09` is rank 1; `linelab/src/**` is evidence, never authority) |
| silent or merely descriptive | either | **STOP.** Do not touch the engine. Land the measurement instead — it is what makes the STOP decidable |

The third row is a *result*, not a failure: a measured, reproducible blast radius attached
to a STOP is exactly the artifact that lets the design owner answer in one sitting.

```js
export const meta = {
  name: 'next-steps-substrate',
  description: 'Classify a substrate defect from the letter, measure its blast radius, and repair only if authorized',
  phases: [
    { title: 'Classify', detail: 'what the design letter decides — before any measurement' },
    { title: 'Measure', detail: 'exactly what moves on committed ink' },
    { title: 'Repair', detail: 'only the defects the letter already decides' },
    { title: 'Verify', detail: 'attack the classification in BOTH directions' },
  ],
}

const DEFECTS = args.defects   // [{id, statement, sections, candidateFix}]

// Deliberate barrier: no defect is measured until every defect is classified, so a
// measurement cannot leak back and colour the reading of the letter.
phase('Classify')
const classified = (await parallel(DEFECTS.map(d => () => agent(
  `Read ONLY the design of record: ${d.sections}. Do not read linelab/src — the letter ` +
  `outranks the code and I want the letter.\n\nDefect: ${d.statement}\n\n` +
  `Does the letter already decide this? Quote VERBATIM with section numbers. Then the ` +
  `question that does the real work: is the quoted sentence NORMATIVE (a requirement) or ` +
  `DESCRIPTIVE (commentary on what typically happens)? Only a normative sentence ` +
  `authorizes changing engine behaviour. Wanting the work to be authorized is exactly ` +
  `what makes this easy to get wrong.`,
  { label: `classify:${d.id}`, phase: 'Classify', schema: {
    type: 'object', required: ['id', 'classification', 'quote', 'normative'],
    properties: {
      id: { type: 'string' },
      classification: { type: 'string',
        enum: ['letter-decisive-defect', 'needs-design-amendment', 'needs-stop-design-owner'] },
      quote: { type: 'string', description: 'verbatim, with file + section + line' },
      normative: { type: 'boolean', description: 'false if the quote is commentary' },
    } } })))).filter(Boolean)

phase('Measure')
const measured = await parallel(DEFECTS.map(d => () => agent(
  `Measure, in numbers, exactly what would move on COMMITTED ink under: ${d.candidateFix}\n` +
  `Recompute from out/chapter-08/*.envelope.json by hand. Do NOT edit code to find out.\n` +
  `Report: which committed lines flip verdict and in which direction; whether the quality ` +
  `word moves (design/05 §6.1 — quality is a total function, so it moves the drawn colour ` +
  `and the terminal word); whether result_hash and SVG bytes move; which named tests and ` +
  `goldens need re-blessing. Measured numbers only — say "unmeasurable" rather than ` +
  `estimating.`,
  { label: `measure:${d.id}`, phase: 'Measure', schema: BLAST })))

phase('Repair')
const authorized = classified.filter(c => c.classification === 'letter-decisive-defect' && c.normative)
log(`${authorized.length} of ${DEFECTS.length} authorized by the letter; ` +
    `${DEFECTS.length - authorized.length} become STOPs with a measured blast radius`)

const repaired = await pipeline(authorized,
  (c) => agent(
    `Repair ${c.id}. It is authorized because ${c.quote} is normative.\n` +
    `Write the test first, and confirm it RED before the fix — a test that passes on the ` +
    `unfixed engine is not evidence. Never delete or loosen an existing test: if one now ` +
    `fails, that is this repair's blast radius arriving, so re-bless it deliberately and ` +
    `say so, or stop. Zero runtime dependencies.`,
    { label: `repair:${c.id}`, phase: 'Repair', schema: BUILT }),
  (b, c) => b && parallel(['does-it-fix-it', 'did-it-over-refuse'].map(lens => () => agent(
    `REFUTE "${b.claim}" through the ${lens} lens, against the rebuilt artifact, not the ` +
    `diff. For over-refusal: does every legal input STILL pass? Check all six committed ` +
    `scenes explicitly. A repair that refuses more than the letter asks is the same ` +
    `error as one that refuses less.`,
    { label: `verify:${lens}:${c.id}`, phase: 'Verify', schema: VERDICT })))
    .then(vs => ({ ...b, survives: vs.filter(Boolean).every(v => !v.refuted) })))

// The STOPs are deliverables too — each one carries its measurement.
return {
  repaired: repaired.filter(Boolean).filter(r => r.survives),
  stops: classified.filter(c => !(c.classification === 'letter-decisive-defect' && c.normative))
    .map(c => ({ ...c, blastRadius: measured[DEFECTS.findIndex(d => d.id === c.id)] })),
}
```

Two habits that make this shape pay off:

- **Adjudicate a cluster as one job.** Four defects in one check interact — a repair to
  one can make another unreachable, or double-count its blast radius. `ROADMAP.md` says
  this about `out_in_out` for exactly that reason.
- **Verify the classification in both directions.** Over-authorizing lets a run rewrite
  the corpus on its own say-so; under-authorizing stops safe work dead. Both are
  expensive, and a single skeptic told only to "check the classification" will drift
  toward whichever the author already chose.
