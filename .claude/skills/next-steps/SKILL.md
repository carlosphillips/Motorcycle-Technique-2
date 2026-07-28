---
name: next-steps
description: Read ROADMAP.md, pick the top unblocked item, and build it end-to-end with a Workflow fan-out — grounding, build, adversarial verification, gates, and roadmap update — without stopping to ask. Use this skill whenever the user says "next steps", "what's next", "continue", "keep going", "pick up where we left off", "advance the roadmap", "make progress", "build the next thing", or otherwise hands you the project with no specific task attached. Also use it when the user asks what remains to be done on linelab, even if they don't ask you to build it — this skill's orientation step is the fastest honest answer.
---

# next-steps

`ROADMAP.md` at the repo root is this project's decision record, not a wishlist. Its
`NEXT` section is written by whoever closed the last pass, and it carries the
prerequisites, the known obstacles, and the reasons earlier attempts died. Your job is
to turn the top of it into landed work — and to do that without a round-trip to the
user, because the reason they invoked this skill is that they don't want to be asked.

**Invoking this skill is the user's opt-in to the Workflow tool.** Use it (see
`references/workflow-templates.md`). Do not use `AskUserQuestion` during a
`next-steps` run.

## The autonomy contract

Autonomy here does not mean "guess and keep moving." This project has an unusually
strong record of *refusing* work on merit — the last pass adjudicated 81 figures and
shipped zero, and that was a success because it settled a question. So:

**Progress is either a shipped artifact with green gates, or a recorded, evidenced
refusal.** Both close a roadmap item. Neither requires permission. What is *not*
progress is a half-built thing, a weakened check, or a question left on the user's desk.

When you hit something only the design owner can decide, you do not stop and you do not
invent an answer — you **write a STOP** (`figures/SCOPE.md` §4 format: `**S<n> — <one
line>.** *Needed by:* … *To decide:* …`), point the roadmap at it, and move to the next
unblocked item. A run should never end with nothing built and nothing settled.

## Step 0 — Orient

Read these before doing anything. They disagree with each other by design; the
precedence order is what keeps an autonomous run honest.

| Source | What it is | Rank |
|---|---|---|
| `design/00`–`09` | the design of record, D1–D46 | **highest — outranks the code** |
| `figures/SCOPE.md` §3–§4 | what was tried, what was killed, and the STOP list S1–S28 | binding history |
| `linelab/DEVIATIONS.md` | where the shipped engine reads differently from the letter | binding history |
| `ROADMAP.md` | what to do next, and in what order | the work-list |
| `linelab/src/**` | what the engine actually does today | evidence, never authority |

Also run `git log --oneline -15` — the last session's commit messages say what actually
landed, which is often narrower than what the roadmap claims.

Sections marked **CLOSED** in `ROADMAP.md` are settled. Do not reopen them, and do not
re-derive work `SCOPE.md` §3 already killed — it says so explicitly, at length, so that
nobody spends another pass rediscovering it.

## Step 1 — Pick the work

From `ROADMAP.md`'s `NEXT` section, in this order:

1. **Stated prerequisites first.** The roadmap names them as hard gates ("Land S15
   first"). A prerequisite is the work item, not an obstacle to route around.
2. **Then the roadmap's own ordering.** When it says "Start at 1 and 2," that is the
   answer to what to build; the candidate table's "known obstacle" column tells you what
   already blocks each one.
3. **`Backlog` only if `NEXT` is empty.**

Take the whole prerequisite plus the one or two items it unblocks — enough to prove the
prerequisite was worth landing. Write the chosen scope to a plan file in the scratchpad
before spawning anything; the workflow reads it, and it's what you reconcile the final
report against.

## Step 2 — Run the workflow

Read `references/workflow-templates.md` and adapt the template that fits the shape of
the work (capability / figure-authoring / audit). The four-phase spine is the same:

- **Ground** — parallel readers, one per source of truth: what the design *requires*,
  what the engine *does*, what was already *tried and killed*. This phase exists because
  the expensive failure mode in this repo is building something `SCOPE.md` already
  refused.
- **Build** — one agent per deliverable, `isolation: 'worktree'` only if they'd collide
  on the same files.
- **Verify** — every claim attacked by independent skeptics prompted to *refute*. A
  claim survives on majority, not on its author's confidence.
- **Record** — the roadmap, `DEVIATIONS.md`, and `SCOPE.md` edits.

## Step 3 — Gates, run by you

**Run the gates yourself in the main loop after the workflow returns.** Not in an agent.
You need to see the actual output — an agent's summary of a test run is not evidence a
test run happened, and this is the step where an autonomous run is most likely to
quietly fabricate success.

```sh
cd linelab
npm run build && npm run typecheck && npm test   # vitest; baseline 53 files, 1430 pass, 4 todo, 0 red
npm run bake:ch8                                  # then again — see below
```

The bake must be run **twice**. After the second run `git status` must show zero moved
artefacts under `out/chapter-08/` and `linelab/figures/` — byte-identical re-bakes are
the determinism guarantee the whole corpus rests on. `figure` exiting 3 is a DEVIATION,
not a failure: the envelope still wrote, and figs 8.5/8.6 do it on a known seam.

**The suite is flaky under load — re-run before you believe a red.** Two of four full
runs on 2026-07-28 went red, 1 and 3 failures, *always* `Error: Test timed out in 5000ms`
on CLI-spawning tests (`A-RECIPE-J` in `test/cli/recipes.test.ts`, `A-EXIT-DECLARED` in
`test/cli/schema.test.ts`), always green in isolation and on re-run, and never touching
the code under change. Re-run the file alone, then the suite. Report a red as real only
once it survives that. Do **not** "fix" it by widening a timeout you did not diagnose —
it is recorded in `DEVIATIONS.md` as an open question about the 5 s per-test wall.

Report the real numbers. If something is red, say so with the output, and say what you
did about it.

## The guardrails

These are what make an unattended run safe here. They come from `design/01 §8`,
`design/09`, and the roadmap's own rules — they are not style preferences.

- **Never change engine code to make a figure or a check pass.** If the engine blocks
  the work, that is a design amendment or a STOP. The roadmap says this twice, in bold,
  because it is the failure mode that would quietly destroy the project's value.
- **Never weaken a check, threshold, golden, or test to turn something green.** A red
  gate is information. Widening the band to swallow it deletes the information.
- **The carrier rule** (S27, `design/01 §A.2`): a check may not be named as a figure's
  carrier until it has been shown capable of a non-`pass` verdict *on that road*. A check
  that grades `na`, or passes on every line drawn, teaches nothing — and a visibility
  assertion on a non-blind corner passes *vacuously*, which is worse than failing.
- **G1 — never draw a path nobody rode.** Every line in a figure is a solved trajectory.
  An authored ideal drawn as if ridden is the "plausible fake" `design/01 §8` refuses.
- **Zero runtime dependencies, ever (D1).** Dev deps only.
- **A doctrine figure must disclaim parity inside the artifact.** This is the whole
  content of S15. A figure that illustrates prose but cannot say so is not shippable.
  But note what S31 settled on 2026-07-28: **a placard is not a general-purpose
  disclaimer.** It reaches the SVG and the manifest. It does not reach the `figure_id`,
  it cannot disclaim a marker the renderer declined to draw, and it cannot be made
  complete about constants that live outside the rubric pack. A figure whose honesty
  needs one of those is not one placard away — it is blocked on the substrate.

If you find yourself reaching for one of these, that is the signal to write a STOP.

### The one case where changing a check *is* the work

The two rules above point the same way — *do not touch the engine to make something
pass*. They do not cover the mirror case, and `ROADMAP.md`'s `NEXT` is now full of it: a
defect in a check or the renderer, where the correct repair turns **committed, shipped,
green** ink red. Do not read the guardrails as forbidding that, and do not read them as
licensing it either. The test is the precedence order at the top of this file:

- **The letter decides it, normatively** → it is a defect. Fix it, even if six figures
  re-bake and a golden moves. `design/00`–`09` outranks the corpus, and the corpus is
  evidence. Re-bake, re-judge, and write it up as a corpus event.
- **The letter is silent, or the sentence you are leaning on is descriptive commentary
  rather than a requirement** → **STOP.** Do not touch the engine on your own authority.

That distinction — normative versus descriptive — is the whole call, and it is the
easiest thing to get wrong in the direction that authorizes your own work. Classify from
the letter *before* you measure the blast radius, never after: a large blast radius makes
a defect feel important, and that is not evidence about what the letter says. Template 4
in `references/workflow-templates.md` encodes the whole procedure, including what a STOP
in this shape must carry (a measured blast radius, which is what makes it decidable).

## Step 4 — Land it

1. **`ROADMAP.md`** — move the item out of `NEXT`. If it shipped, write what it
   delivered; if it was refused, write the evidence and why, in the same voice as the
   existing CLOSED sections. Negative results get the same treatment as positive ones —
   look at the "extend past Chapter 8" section for the register. Then set the new `NEXT`.
2. **`linelab/DEVIATIONS.md`** — any place the engine read differently from the letter,
   with a status from that file's vocabulary (`adjudicated-fixed`,
   `implemented-invariant-first`, `pinned-engine-truth`, `needs-decision`).
3. **`figures/SCOPE.md` §4** — new STOPs, with the next free `S<n>`. Mark resolved ones
   resolved rather than deleting them.
4. **Commit** on `main` with a message in the existing style — a declarative sentence
   about what changed, not "update files". Do not push.

## Report back

Keep it short; the artifacts carry the detail.

```
Built: <what landed, with paths>
Gates: build ✓ / typecheck ✓ / test <N pass, M todo, K red> / bake ×2 byte-identical ✓
Refused: <what was attempted and died, with the one-line reason>
STOPs: <S<n> — one line each, or "none">
Next: <the new top of ROADMAP.md NEXT>
```

If everything in `NEXT` turned out to be blocked, the deliverable is the recorded
blockers plus the best available unblocked item from `Backlog`, built. Say plainly what
you left and why. Scaling the work down is the user's call — but so is being told about
it, which is what the report is for.
