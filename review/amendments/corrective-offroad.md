## Cluster: Corrective Shot + Off-Road Termination (review §2.2, §2.3, §1 runoff-endpoint rows, premature oracle pin)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS the corrective-shot law:** the corrective is a branched
>   SHADOW, never inside the main integration; `correction` is a shot-start bookmark;
>   the drawn line is always the uncorrected consequence; the ghost overlay is
>   stepper-only, never exported. misjudgment's ridden-in requirement is WITHDRAWN;
>   fig 8.5's callouts anchor on the main-line `correction`/`run_wide_detect`/`end`
>   events (annotation-grammar's label-feature set gains `correction` and
>   `run_wide_detect`), and the 8.5 ink departure is recorded as a disclosed parity
>   note. doctrine-catalogue's corrective-counts-as-input clause is deleted;
>   corner-exit's REQ-STEER-OWNERSHIP slot 1 is rescoped to within-shadow only.
> - **This section WINS `terminated`:** merged shape `{reason ∈ crash|off_road|
>   stopped|road_end|max_time|max_dist, s, t, x, y}` (closed), per-step precedence
>   `crash > off_road > stopped > road_end > max_time > max_dist`, "corner end"
>   deleted as a terminator, `stop` event ↔ `stopped` reason spelling deliberate,
>   muAt lateral clamp + drawn-endpoint rule as written.
> - **Outcome law re-key (Option B, doctrine-catalogue).** The outcome enum in §2.4
>   respells to `crash > runoff > wide > stopped > contained`: `violation`/`clean`
>   retired as outcome values (`clean` = derived predicate), `dnf-spec-error` DELETED
>   (bug-sheet 9.11 wins: refusals are LineRefusal envelope entries; runtime spec
>   errors are exit 4 INTERNAL). Quality words: `good | caution | failing` — `stopped`
>   maps to `caution` (amber), exactly this section's U3 recommendation (the tier word
>   `contained` is renamed `caution`; the OUTCOME word `contained` is unchanged).
> - **Fixtures re-keyed to the preset hand flip (scene-vocabulary wins):** `book90`
>   defaults LEFT-hand (the book's ink). The §4 oracle row and `G-CORR-RUNOFF` run on
>   plain `book90`; the wide twin respells `G-CORR-WIDE` on `book90 hand=R`; the
>   `book90L` name and its inline-DSL fallback are deleted.
> - **Kinds respelled in place:** `premature` = the canonical runs-wide error (nee
>   `early_apex`); the one normative pin table lives in 03 §7.1 (verification's
>   structure, fixtures `F-ORACLE-90/DR/CHAIN`).
> - `corrective` verdict member rides the merged Verdict verbatim (in `result_hash`);
>   one extra engine run per ran-wide corner enters `C-RECOMPUTE-BUDGET`.

This section turns two names into mechanisms: the **corrective shot** (the machinery
that decides `wide` vs `runoff`, currently defined only as "a feasible add-lean
corrective exists" with 02 and 04 pointing at each other) and **off-road
termination** (currently absent from 02 §7's precedence, so every red line
integrates across the grass to a runaway guard while 05/06/07 assume it ended).
It also pins the closed `terminated.reason` vocabulary (including the `stopped`
cause the run-wide-physics cluster needs), the drawn-endpoint rule for red lines,
the auto-window fallback for lines with no `exit` event, and the `premature`
oracle entry on a named fixture.

Design laws honoured: D7 (the corrective is engine-integrated, never authored),
D8 (every new field/reason is a closed typed vocabulary), D9 (the wide/runoff
split changes headline and teaching, not the colour derivation), D6 (the shadow
run is an *output*; it never rides the wire; consumers recompute it).

---

### 1. The corrective shot — `correctiveShot` (closes review §2.2)

**Home: 04, new top-level section "The corrective shot", placed between §4 (the
solve pipeline) and §5 (chained-corner solving).** This ends the 02↔04 ownership
circle: 04 owns the algorithm; 02 §7 and 05 §6 point here.

#### 1.1 What it is — and what it deliberately is not

The corrective shot is a **fixed-policy counterfactual**: one deterministic shadow
re-integration that asks "could a rider who noticed the drift and calmly added
lean to the street reserve have stayed on the road?" It is *not* a search (the
prior design's 26-iteration bisection for minimum save lean is dropped), *not*
part of the main integration (the drawn line never contains it), and *not* a plan
action (nothing about it is authorable).

Why fixed-policy instead of the carried bisection: (a) one shot is deterministic
and cheap (one extra engine run per ran-wide corner, bounded — it starts mid-run
and ends at first return or road end); (b) the doctrinal question is binary
("was this recoverable within reserve?"), and the bisection's minimum-lean readout
served a diagnosis nuance (`roll_rate_limited` vs `overspeed_entry`) that the
recorded shot state still supports; (c) a bisection inside the verdict pipeline
makes `result_hash` sensitive to solver iteration internals — the review's
determinism complaint bites exactly there.

#### 1.2 Detect predicate (the `run_wide_detect` event)

```
run_wide_detect := the first bracketed crossing where
                   f rises through F_DETECT + eps_f_detect
                   with df/dt > 0 (outward)  and  a turn_in event has occurred

F_DETECT     = 1.0    (the outer usable edge — definitional, not TUNING)
eps_f_detect = 0.01   (TUNING — classification deadband; a line that grazes
                       f = 1.005 is not "running wide")
```

Crossing coordinates (`s, t, x, y, f, v`) are located by the standard event
bracketing of 02 §6 (linear interpolation between the last conforming and first
violating step). The event lands in the main line's `events` array (already in
05 §5's closed kind set). At most one `run_wide_detect` per corner: the first
outward crossing attributed to that corner (attribution: the last corner whose
`s0 ≤ s_detect` — a drift on the exit straight belongs to the corner being
exited). The `turn_in`-must-precede guard keeps a legitimate `f = 1.0` start
position (the schema default) from firing detection on sample noise.

**Outward-only, by design — this section owns the corridor-departure predicate
(doctrine-catalogue §1 consumes it).** No detect event exists for the inside
direction: an inside-corridor excursion (`f < −eps_f_detect` while still on
pavement — toward or across the centreline) is doctrine-check territory
(`out_in_out`, `chain_containment`), never an outcome mechanism, and no inside
corrective is defined — the save the book credits is add-lean against *outward*
drift. An inside excursion that crosses the physical edge terminates `off_road`
(§2.1 — the `|d|` test covers both edges) and classifies `runoff` via §1.7's
table; one that returns and reaches road end is `contained`, graded by its
checks.

#### 1.3 Shot start: reaction (+ freeze)

```
t_shot = max(t_detect, t_freeze_end) + t_react_s
```

- `t_react_s` is the rider profile's recognition delay (02 §3 — this is the
  hitherto-dangling "used by run-wide correction" sentence, now grounded).
- `t_freeze_end` exists only when the line's mistake spec carries a rider freeze
  (today: `chop`'s `freeze_s`, 03 §7.1). A frozen rider cannot begin reacting;
  recognition starts when the freeze releases. For all other lines
  `t_freeze_end = −∞` and the formula reduces to `t_detect + t_react_s`.
- The shot's initial state is `stateAt(mainLine, {t: t_shot})` — full recorded
  state, no re-derivation.
- **If the main trajectory terminated before `t_shot`** (it went off-road,
  crashed into a `stopped` floor, or hit road end while the notional rider was
  still reacting), the shot is not integrable: `feasible = false`,
  `fail_reason = "departed_before_reaction"`. This is not a degenerate corner
  case — it is the *normal* mechanism by which a short corner with a hard
  outside edge pins `runoff` (see §4).

The `correction` event (already in 05 §5's closed kinds) is hereby defined as
**the shot-start bookmark**: kind `correction` at `(s_shot, t_shot)` on the main
line, emitted iff the corrective was attempted, `detail: {feasible}`. It marks
"the last moment a save had to begin" — a stepper jump target
("step to where the save had to start"), resolving the fig-8.5 ambiguity about
what this event means (it never implies the main line bends back).

#### 1.4 Control policy (the shadow run)

From the shot state, re-integrate through the same pure stepper (`core/`, same
`dt_s`, run-wide slice active) under a constant controller:

```
target_lean = sign(corner.hand) · phiReserve(skill · config.mu)   // 40.36° street/mu 1.0
roll_rate   = the rider profile's cap (unchanged)
a_cmd       = 0                                                    // throttle closed, no brake
```

- **Toward `phiReserve`, not `phiMax`**: the doctrinal question is "recoverable
  by a competent street rider *within reserve*" — a save that needs the physical
  ceiling is the danger zone, not a save (user decision U2 records the
  alternative). A pleasant consequence: with `a_cmd = 0` and lean capped at the
  reserve, the shadow cannot violate the ellipse on uniform `mu` — ceiling
  violations can come only from hazard patches under the shadow path, which is
  exactly when they should.
- **`a_cmd = 0` with clean command history**: the shadow starts with an empty
  command-rate history — `a_cmd_rate` for its first step is defined `0` — so the
  transient stand-up term cannot fire off the shot's own start artifact. (The
  run-wide-physics cluster's onset-slew respec makes this moot for sustained
  behaviour; the empty-history rule keeps the shot well-defined either way.)
- The run-wide slice stays active (02 §5.6's requirement, now mechanically
  satisfiable): with `a_cmd = 0` the sustained term is dormant
  (`−a_clip < A_SU_ONSET`), which is the *point* — the save the doctrine credits
  is add-lean-off-the-brakes; a save that would require braking at lean is
  penalised by the physics automatically if a future policy variant commands it.

#### 1.5 Success predicate and termination of the shadow

The shadow integrates under the **same termination rules as any run** (§2 below)
until the earlier of: first return, or its own termination.

```
feasible := ∃ a bracketed station s* on the shadow, s_shot < s* ≤ road end,
            with f(s*) ≤ F_SAVE + eps_f_save,
            reached before any shadow termination of kind
            off_road | crash | stopped

F_SAVE     = 1.0     (back inside the outer usable edge)
eps_f_save = 0.03    (carried TUNING — the prior design's 3 % return tolerance;
                      doubles as the wide/runoff classification deadband)
```

`fail_reason` (closed set, D8): `"departed_before_reaction"` |
`"shadow_off_road"` | `"shadow_crash"` | `"shadow_stopped"` |
`"no_return_before_road_end"`.

#### 1.6 Recorded shape (05 §6.3 `corners[].corrective`)

```
corrective : null | {
  feasible:    boolean,
  detect:      { s, f },                       // bracketed crossing, main line
  shot:        { s, v_kmh, phi_deg, target_phi_deg },   // state at t_shot + policy
  returned:    { s, f } | null,                // first return station (feasible only)
  fail_reason: null | <closed set, §1.5>       // set iff !feasible
}
```

- `null` ⇔ never attempted: the corner did not run wide **outward** (including
  the inside-side `off_road` departure — §1.7 classifies it `runoff` with no
  shot, per §1.2's outward-only law), or the main run crashed (carried rule,
  restated normatively: **crash strictly precedes corrective solving — no save
  is computed for a lowsided trajectory**).
- The block is **inside `result_hash`** (it is classification-bearing — `feasible`
  decides the headline). The shadow *trajectory* is not part of the envelope, the
  CSV, or any hash: it is recomputable output, exposed as a pure API
  `correctiveShot(lineResult) → Result<{corrective, shadow: Trajectory}>` (added
  to 08 §7.1's import list) so a viewer *may* draw the save as a ghost overlay
  (user decision U1). D6 provenance: the shadow is engine output derived from
  shared inputs; sharing is unaffected.

#### 1.7 The wide-vs-runoff decision

```
ran_wide(corner) := a run_wide_detect event attributed to that corner exists
outcome contribution per corner:
    crash event anywhere            → crash        (corrective null)
    ran_wide ∧ corrective.feasible  → wide
    ran_wide ∧ ¬feasible            → runoff
    terminated off_road ∧ ¬ran_wide → runoff       (inside-side departure: no
                                                    outward detect, corrective
                                                    null — §1.2's outward-only law)
headline (multi-corner): worst class under the merged precedence
    crash > runoff > wide > stopped > contained               (see §2.4 for stopped)
```

Colour law v2 is untouched: `wide`, `runoff`, `crash` all map to `failing`/red
(06 §5.1). The split changes the **headline, diagnosis, and teaching text**
("recoverable with reserve lean from s=31" vs "unrecoverable — already off the
road before a reaction was possible"), never the paint. D9 holds.

#### 1.8 Main-integration vs branched-shadow: the decision, and its determinism consequences

**The corrective runs as a branched shadow, never inside the main integration.**
Consequences, stated so the trade is auditable:

- The drawn line for a `wide` outcome is the *uncorrected* consequence of the
  authored plan — exactly the book's figs 8.1–8.3 red ink. The one-perturbation
  diff property survives (the mistake line's samples are a pure function of its
  plan); a main-line corrective would embed analyzer output in the trajectory
  and break it.
- `Trajectory` samples and the trace CSV are byte-independent of the corrective
  machinery; the only main-line artifacts are two events (`run_wide_detect`,
  `correction`) and the verdict block. A corrective implementation refinement
  that does not flip `feasible`/`returned` perturbs nothing else.
- The shadow uses the same pure stepper at the same `dt`: `P-DETERMINISM` covers
  it for free; cross-runtime tolerance-equality applies unchanged. The one new
  discrete boundary — `feasible` — carries the `eps_f_save` deadband, and the
  pinned fixtures (§4, §5) sit far from it *by construction* (0.4 m vs ≈3.9 m of
  pavement beyond the usable edge — a 10× geometric separation between the
  runoff and wide fixtures).
- Cost: one bounded extra engine run per ran-wide corner. This must be counted
  in the recompute-budget arithmetic (interaction: the C-RECOMPUTE-BUDGET
  re-scope, review §7).

Replaces: 04 §4.3's bullet "The corrective-action solver … must model the save
under the same stand-up coupling" (now a pointer to the new section);
02 §7's `runoff`/`wide` bullet definitions (now "split decided by the corrective
shot, 04 §<new>"); 02 §3's dangling "`t_react_s` is the recognition delay used
by run-wide correction" gains the forward reference.

---

### 2. Off-road termination (closes review §2.3)

**Home: 02 §7 (precedence + reason vocabulary), 03 §2 (edge geometry + `muAt`
clamp), 05 §2/§5 (terminated shape + event kind).**

#### 2.1 The lateral-departure trigger

The RoadModel gains derived per-station **physical edge offsets**
`{d_left(s), d_right(s)}` — the carriageway edges in signed-`d`. For the v1
constant-width two-lane road this forces one currently-implicit fact to be
pinned in 03 §2: **the parameterized centreline is the carriageway centre (the
lane divider); the rider's own lane is the hand-of-travel side; the physical
edges sit at `d = ±lane_width_m`.** (`bike_margin_m` and the usable corridor are
doctrine constructs inside the own lane; they play no role here.)

```
off_road := |d| > lane_width_m        (equivalently d > d_left or d < d_right)
```

evaluated per step in the termination scan; the crossing is located by the
standard event bracketing (02 §6 gains "off-road" in its crossing list), so the
terminal sample carries **exact crossing coordinates on the road edge** — not a
post-step point in the grass. An `off_road` event (new kind, appended to 05 §5's
closed set) is emitted at the crossing; the run terminates there.

Note the deliberate asymmetry with §1.2: `run_wide_detect` is an *f*-space
doctrine event (crossing the usable corridor); `off_road` is a *d*-space physical
event (crossing the pavement). Between them lies the corrective's window — on a
right-hander the oncoming lane (≈3.9 m of pavement), on a left-hander only the
bike margin (0.4 m). That asymmetry is real teaching (running wide into oncoming
traffic vs off the road) and is what makes the §4 oracle pin work.

#### 2.2 Off-road `mu` policy: there is none, on purpose

`muAt(s, d)` is defined **only on the carriageway**; for `|d| > lane_width_m` it
returns the value at the laterally clamped point `muAt(s, clamp(d))`. This
definition exists solely so the RK4 sub-stages of the crossing step (which may
evaluate derivatives fractionally beyond the edge before the bracket terminates
the run) are well-defined. **No grass physics is modelled and no trajectory
sample is ever emitted beyond the bracketed crossing.** This is the placard
policy applied to termination: off-road riding is out of scope (D5), so the
honest output is a terminal event at the edge, never a plausible-looking tail
across the grass at dry-asphalt grip — the exact "wrong-but-plausible picture"
01 §8 forbids. (Placard text for the HUD/POV terminal badge: *"left the road —
off-road behaviour not modelled"*.)

#### 2.3 The closed `terminated.reason` vocabulary and precedence

05 §2's `Trajectory.terminated` becomes (append-only: two coordinate fields):

```
terminated = { reason, s, t, x, y }        // (x, y): the bracketed final position

reason ∈ "crash" | "off_road" | "stopped" | "road_end" | "max_time" | "max_dist"
```

**Termination precedence per step (replaces 02 §7's line verbatim):**

```
crash  >  off_road  >  stopped (v < v_floor_ms)  >  road_end  >  max_time  >  max_dist
```

- `crash` above `off_road`: a step that both lowsides and departs reports the
  more severe physical fact (and preserves the carried "crash precedes
  corrective" rule).
- `off_road` above `stopped`: crossing the edge is the doctrinally salient fact;
  a stopped-in-the-grass state is unrepresentable by construction.
- **"corner end" is deleted from the termination line.** The prior wording
  "road/corner end" invited terminating a chained line at corner 1's end (the
  fig-8.6 finding). Runs terminate at **road end** only; corners are analysis
  windows, never terminators. (Interaction: chained-solving cluster.)
- Reason↔event mapping: `crash`→`crash` event, `off_road`→`off_road` event,
  `stopped`→`stop` event (the two spellings are both already committed; pinned
  here as deliberate), `road_end`→`road_end` event. `max_time`/`max_dist` are
  runaway guards with no bookmark event — there is nothing pedagogical at a
  guard, and the reason field records it.

#### 2.4 `stopped` gets an outcome class (shared surface, requested by the run-wide-physics cluster)

The verdict outcome set (05 §6.1) gains one member:

```
outcome    : "crash" | "runoff" | "wide" | "stopped" | "contained"     (merged, Option B)
precedence : crash > runoff > wide > stopped > contained
```

(`violation`/`clean` are retired as outcome values — `clean` is the derived predicate
contained ∧ zero applicable check fails; `dnf-spec-error` is deleted — refusals are
`LineRefusal` envelope entries, runtime spec errors exit 4 `INTERNAL`.)

`stopped` = the run terminated at the model-validity floor before road end and
none of the classes above it apply. Colour law (06 §5.1): `stopped` maps to quality
**`caution`/amber** — the bike stayed on the pavement and broke no
ceiling, but a line that stops mid-corner is not a demonstrated line (user
decision U3 records the red alternative). 08 §3.1's exit-0 outcome enumeration
adds `stopped` (still tier 0: a stop is a valid, interesting run). Doctrine
checks run over the partial trajectory as usual; checks whose span was never
reached report `na` (already the check vocabulary).

---

### 3. The drawn endpoint and the auto-window fallback (05/06/07 consumers)

#### 3.1 Drawn-endpoint rule for red lines (06 §3.1, draw stage 8)

Normative sentence added to 06 §3.1: **every line's polyline ends at its
trajectory's final sample, and the arrowhead sits on that sample, oriented to
the final heading `psi`.** Because `off_road` terminates at the bracketed edge
crossing (§2.1), a runoff red line's arrowhead lands **exactly on the road
edge, pointing off it** — which is precisely the book's ink (figs 8.1/8.2: red
arrowheads on-pavement at the outer edge, aimed at the consequence).

Terminal glyph variants keyed by `terminated.reason` (presentation-only,
appended to 06 §3.1's marker vocabulary; sizes TUNING):

| reason | terminal treatment |
|---|---|
| `road_end` | plain arrowhead (the natural exit — no extra glyph) |
| `off_road` | arrowhead on the edge crossing + a short tick along the road edge at the crossing |
| `crash` | ×-burst glyph at the final sample (replaces the arrowhead) |
| `stopped` | transverse bar (a "full stop" tick) at the final sample |
| `max_time` / `max_dist` | plain arrowhead + the manifest records the guard (a guard ending in ink would be a bug surfaced by the vision judge) |

07 §3.1/§3.4's prose "(crash, road-end/run-off, stop)" is replaced by the pinned
vocabulary: the terminal badge and the shaded scrubber region key off
`terminated.reason`; the off-road badge carries the §2.2 placard text.

#### 3.2 Auto-window fallback (replaces 06 §2.4's formula)

The current formula reads events off an unnamed line and assumes an `exit` event
exists. Replacement, defined over **all lines of the figure** in true metres:

```
end_anchor(line)   = s of the line's exit event, if one exists
                     else terminated.s                       // crash, off_road, stopped
                     else s of the line's last sample        // road_end, guards

start_anchor(line) = s of first(turn_in, brake_start, position_start)
                     else s of the line's first sample

window.from = min over lines of start_anchor(line) − WINDOW_LEAD_M   (15 m TUNING)
window.to   = max over lines of end_anchor(line)   + WINDOW_TAIL_M   (25 m TUNING)
both clamped to [0, road length]
```

Guarantees, stated as the reason the rule exists: **every line's terminal sample
— the pedagogically loudest pixel of every red line — is inside the frame**, for
any mix of clean and terminated lines, with no authoring. Lateral framing needs
no special case: since off-road runs terminate *on* the edge, no drawn geometry
exists outside the road corridor plus the occluder band. (Interaction: the
solver-constants cluster's corner-relative respec of absolute-metre constants
may re-express LEAD/TAIL as arc fractions; the min/max-over-lines and
end-anchor-fallback structure is what this cluster pins.)

---

### 4. The `premature` oracle pin, made implementable (review §1 rows + §9.2, premature share)

The 01 §4.3 vs 03 §7.1 disagreement (`wide/runoff` vs `runoff`) dissolves once
outcomes are pinned **per (kind, fixture)** rather than per kind: outcomes are
road-dependent, so the oracle table (09 §4) gains a fixture column. This cluster
owns the `premature` row; the mistake-compiler cluster fills the rest with the
same mechanism.

```
kind        fixture                                          entry    profile   pinned outcome
premature   book90 (preset default hand = L per the          34 km/h  street    runoff
            scene-vocabulary hand flip — figs 8.1/8.2 are    (preset
            left-handers; oracle name F-ORACLE-90)           default)
```

with `early_by_m = 10` (the kind's default — the annotation-grammar cluster's
§5.1 kind-definition site) and the oracle asserting, beyond the
outcome class: `corrective.feasible = false`, and `terminated.reason =
"off_road"`. (`fail_reason` is recorded, not pinned — either
`departed_before_reaction` or `shadow_off_road` is a legitimate mechanical
route to the same doctrinal fact.)

**Why the corrective reliably fails there.** On a left-hander the outside of the
corner is the physical road edge: beyond `f = 1` there is only
`bike_margin_m = 0.40 m` of pavement. At `early_by_m = 10` the replaced
`turn_in` sits 10 m before the solved one — ≈ 53 % of the 18.85 m arc (the
superseded working at the old default of 5 gave ≈ 27 %; doubling the offset only
enlarges every divergence below, so the pin holds with *more* margin, not less).
The compiled `premature` commits lean to kiss the inside that much earlier, so
the committed apex lands in the first half of the corner and at detection the
exit geometry already points outward at a steeper angle than the 5 m working
showed; crossing 0.40 m laterally takes correspondingly less travel, still far
under the reaction distance (`v · t_react_s ≈ 8 m` at the fixture's ≈ 30 km/h
solved turn-in speed — roughly 40 % of the entire 18.85 m arc, and independent
of `early_by_m`). The main run therefore goes `off_road` before `t_shot`
arrives (`departed_before_reaction`), or, if detection fires unusually early,
the shadow cannot null a committed-lean geometry inside 0.40 m
(`shadow_off_road`). The margin is structural (an order of magnitude, and it
*widens* as `early_by_m` grows), not a tuning accident.

The mirror twin is deliberately pinned the other way: the same mistake on the
**right-hand** `book90` runs wide across `0.40 m margin + 3.5 m oncoming lane ≈
3.9 m` of pavement — room for react + roll + capture — and pins **`wide`** (see
golden G-CORR-WIDE). One geometry, mirrored, flips recoverability because the
outside differs: *oncoming lane vs grass*. That pair is both the sharpest
possible test of the corrective machinery and honest book teaching.

Oracle discipline carried verbatim: if tuning drift ever breaks a pin, the fix
is the engine or the kind's default (`early_by_m`), never the pin (09 §4's iron
rule). The pinned rows in 01 §4.3's table change from prose classes to
references: "outcome pinned per fixture — see the oracle table".

Interaction note (RESOLVED): scene-vocabulary's preset hand flip landed —
`book90` is left-hand by default, so the oracle fixture is the plain preset;
the `book90L` name and the inline-DSL fallback are deleted. The mirrored
right-hand twin is spelled `book90 hand=R`.

---

### 5. Goldens, properties, and acceptance tests (09 additions)

**Goldens (09 §3.2 fixtures; numeric-with-tolerance at the model layer):**

- `G-CORR-RUNOFF` — `book90` (left-hand default) + `premature` (the §4 oracle fixture = `F-ORACLE-90`): outcome
  `runoff`; `corrective.feasible = false`; `terminated.reason = "off_road"`;
  terminal sample satisfies `|d| = lane_width_m ± eps_m (0.05)` — the endpoint
  is *on* the edge.
- `G-CORR-WIDE` — `book90 hand=R` (the mirrored right-hand twin) + `premature`: outcome
  `wide`; `corrective.feasible = true`; `returned.s` recorded and pinned with
  tolerance; the main line still carries its own endpoint per §3.1.
- `G-OFFROAD-BRACKET` — extends `P-EVENT-BRACKET`: the `off_road` crossing lies
  between the last on-road and first off-road integrator step, within one step.
- `G-STOPPED` — a straight-road hard-brake-to-floor scenario: `terminated.reason
  = "stopped"`, outcome `stopped`, exit tier 0, amber quality class. (Shared
  fixture with the run-wide-physics cluster's `stopped` work.)
- `C30-chop` (existing, 02 §8) — its `wide`/`runoff` pin can now be sharpened to
  a single class by this machinery; the choice belongs to the mistake-compiler
  cluster's fixture table, using §1's split.

**Properties (09 §3.4 additions):**

- `P-TERMINATED-CLOSED` — every run (fuzzed schema-valid scenarios included)
  terminates with `reason` in the closed set and a final sample equal to the
  bracketed `terminated {s, t, x, y}`; no sample ever satisfies the off-road
  predicate by more than the bracketing tolerance.
- `P-CORR-PURE` — `correctiveShot` is a pure function of the line result: run
  twice → identical `corrective` block and tolerance-equal shadow trajectory
  (subsumed by `P-DETERMINISM`, named so the shadow is explicitly covered).
- `P-CORR-SHADOW-HONEST` — the shadow run obeys every main-run law: `P-ELLIPSE`,
  `P-ROLLRATE` (tracker component), and the termination vocabulary. A shadow is
  a run, not a special case.
- `P-ENDPOINT-IN-FRAME` — for fuzzed figures under the default window, every
  line's terminal sample projects inside the drawn frame (the §3.2 guarantee as
  a property).

**Acceptance (09 §6/§7):**

- `A-FIG81-ENDPOINT` — the fig-8.1-equivalent scene (clean + `premature` on the
  left-hand road): the red line's arrowhead lies on the outer road edge inside
  the frame; the vision judge's rubric gains one sentence: *a failing line's
  endpoint must sit at its termination, never wander in the grass or exit the
  frame uncropped*.
- `A-CORR-EXPLAIN` — `explain` on `G-CORR-WIDE`'s envelope narrates the save
  ("recoverable: reserve-lean save from s=…, returned at s=…"), and on
  `G-CORR-RUNOFF` names the fail_reason — the corrective block is legible, not
  just recorded.

---

### 6. Placement summary (doc → change)

| Doc | Change |
|---|---|
| 02 §3 | `t_react_s` sentence gains forward reference to 04's corrective section |
| 02 §6 | event-bracketing list gains the off-road crossing |
| 02 §7 | termination precedence line **replaced** (§2.3 here); `runoff`/`wide` bullets replaced by pointers to 04; reason table added; "road/corner end" → "road end" |
| 03 §2 | centreline = carriageway centre pinned; physical edges `d = ±lane_width_m`; `muAt` lateral clamp (§2.2 here) |
| 03 §7.1 | `premature` outcome cell → "pinned per fixture (09 §4): `runoff` on `F-ORACLE-90` (= `book90`, left-hand default)" |
| 01 §4.3 | outcome column notes classes are fixture-pinned; `premature` row cites the oracle fixture |
| 04 new § | the corrective shot, §1 here in full; 04 §4.3 corrective bullet replaced by pointer |
| 05 §2 | `terminated` shape gains `x, y`; reason vocabulary pinned |
| 05 §5 | `off_road` event kind appended; `run_wide_detect` and `correction` definitions added |
| 05 §6.1 | outcome set + precedence gain `stopped` |
| 05 §6.3 | `corrective` field gets the §1.6 shape |
| 06 §2.4 | window formula **replaced** by §3.2 here |
| 06 §3.1 | drawn-endpoint sentence + terminal-glyph table (§3.1 here) |
| 06 §5.1 | `quality` mapping: `stopped` → `caution` (amber tier; merged quality words `good|caution|failing`) |
| 07 §3.1, §3.4 | terminal prose re-keyed to `terminated.reason`; off-road placard text |
| 08 §3.1, §7.1 | exit-0 outcome list gains `stopped`; import list gains `correctiveShot` |
| 09 §3.2/§3.4/§4/§6/§7 | §5 here; oracle table gains the fixture column |

---

### 7. Decision drafts (editor numbers them)

- **Draft: "The corrective shot is a fixed-policy counterfactual."** The
  wide/runoff split is decided by one deterministic shadow re-integration
  (react → roll toward `phiReserve` at profile rate, `a_cmd = 0`, same stepper,
  run-wide slice active), never by a search and never inside the main
  integration. The drawn line is always the plan's own consequence; the save
  exists as verdict data and a recomputable ghost. Rationale: decidability
  (review §2.2), hash/determinism hygiene, the one-perturbation diff property,
  and the book's ink (figs 8.1–8.3 draw the uncorrected consequence).
- **Draft: "The world ends at the road edge."** Lateral departure is a terminal
  event with bracketed crossing coordinates; `terminated.reason` is a closed
  six-value vocabulary; off-road physics is refused (lateral `muAt` clamp
  exists only to keep the crossing step well-defined), and `stopped` joins the
  outcome classes. Rationale: the placard policy applied to termination — an
  honest endpoint on the edge instead of a plausible tail across grass at
  asphalt grip; every consumer (05/06/07) already assumed early termination the
  owner doc never specified.

### 8. User decisions

- **U1 — Should the viewer offer the corrective save as a ghost overlay?** The
  data is free (pure recompute via `correctiveShot`). *Recommendation: yes, as a
  toggleable ghost in the stepper only (off by default; never in exported
  figures) — exported book-parity figures show the uncorrected consequence, the
  interactive surface may reveal the counterfactual.*
- **U2 — Shot target `phiReserve` vs `phiMax`.** Reserve says "recoverable by a
  competent street rider"; ceiling says "physically recoverable at all". A
  two-tier shot (reserve, then ceiling, recording which tier saves) is richer
  but costs a second shadow and a three-way boundary. *Recommendation:
  `phiReserve` only for v1 — it matches the doctrine's definition of a save and
  keeps the shot crash-free by construction on clean surface.*
- **U3 — Colour of `stopped`.** Amber ("contained: on pavement, no ceiling
  broken, but no line demonstrated") vs red ("failed to make the corner").
  *Recommendation: amber — a vis-governed line that stops within sight distance
  is doctrinally correct behaviour, and red would punish exactly the caution the
  tool teaches; a stop caused by a mistake still reads failed via its checks.*
