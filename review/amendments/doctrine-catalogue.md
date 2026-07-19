## Doctrine Check Catalogue + Rubric Identity (cluster: doctrine-catalogue)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins.
>
> - **This section WINS the outcome law** (Option B adopted project-wide; owner
>   ratification listed in the master plan): `outcome ∈ crash|runoff|wide|stopped|
>   contained`, physics-only; `clean` derived; `violation` retired. One consequential
>   edit: `dnf-spec-error` is DELETED outright (bug-sheet 9.11 wins — refusals are
>   `LineRefusal` envelope entries; runtime spec errors are exit 4 `INTERNAL`), so the
>   quality law has no dnf branch.
> - **Quality tier words renamed `good | caution | failing`** (editor homonym fix,
>   grammar audit): the amber tier word `contained` collided with the new OUTCOME
>   value `contained` ("contained (contained)" on the legend). Colour mapping
>   unchanged; quality words live only on presentation surfaces (06 §5.1, legend,
>   manifest), so the rename is pre-implementation cheap.
> - **The catalogue is 16 ids**: + `wrong_strategy_for_corner` (misjudgment's check,
>   arithmetic as written there; the sole v2 `critical`, contingent on owner decision
>   U1 = Mechanism A). The binary `tier ∈ gate|advisory` is REPLACED by one pack-data
>   field `severity ∈ advisory|standard|critical` (`gate` ≡ `standard`; a failed
>   `critical` renders `failing`/red without physical departure). The pack schema's
>   old metric-band map field renames to `bands` to free the word.
> - **Apex/touch detection**: this section's `touches` field and `DA_RISE_F` are
>   DELETED — the ONE recorded detector is misjudgment's hysteresis rule
>   (`APEX_PROMINENCE_F = 0.08`, `APEX_MIN_SEP_M = 5.0`) feeding
>   `corners[].apexes[] = [{s, pct, f, clearance_m, v_kmh, lean_deg}]`; checks read
>   that list (`late_apex` reads the final entry's `pct`; `out_in_out`'s double-apex
>   carve reads min over `apexes[]`).
> - **Exit sample**: `EXIT_EPS_DEG = 2.0°` and `EXIT_LOOKAHEAD_FRAC` are DELETED —
>   checks cite the RECORDED `exit` event (corner-exit's `EPS_EXIT_DEG = 1.0°`
>   deadband), falling back to the link station on chained corners as already
>   specified.
> - **Stopping function and sight basis**: `ssd_lean(v, phi, mu)` respells to the one
>   exported `ssd(v, phi, model, profile, mu) → {ssd_m, react_m, standup_m, brake_m}`
>   (runwide-physics owns); every sight-vs-ssd comparison (checks 10/11) reads the
>   recorded `sight_ride_m` (bug-sheet 9.4), never `sight_m`.
> - **Chain predicate**: the geometric formula keeps ONE name — solver-refit's
>   `linked_next` with `LINK_GAP_FRAC = 1.0` (the duplicate `CHAIN_GAP_ARC_FRAC` name deleted). This
>   section WINS applicability: chain-mode = geometric chain AND ridden-linked (per
>   the line's own trajectory); solver-refit's claim weakens to "same applicability
>   RULE for every line".
> - **This section WINS `checks_version`** (independent metric-code version; rubric =
>   `"<pack>/<version>"` data identity; agent-interface's derived-from-pack sentence
>   is dropped) and the graded double-apex special case (misjudgment's blanket `na`
>   carve-out loses; the ≥3-always-fails anti-gaming rule survives).
> - **Corrective inputs**: the "corrective-shot lean-add counts as an input" clause is
>   DELETED — the corrective is a branched shadow (corrective-offroad wins); shadow
>   inputs never appear on the graded line's commanded channel.
> - **Sample field**: the stored stand-up channel is the split `su_sustained` +
>   `su_transient` (pov-samples wins); `phi_dot_su ≡` their sum, defined notation —
>   this section's formulas read the sum unchanged.
> - **Pins**: this section's §7 table becomes a VIEW of the one normative table in
>   03 §7.1 (verification's structure; fixtures `F-ORACLE-90/DR/CHAIN`; kinds
>   respelled in place — `premature` = runs-wide, `premature_contained` = eased).
>   Its `fifty_pence` cell re-keys to `wide` (+ mandatory `single_input` fail) per
>   verification's owner-framed decision; `chop` stays `runoff`. Its `premature`
>   cell re-keys too: outcome `runoff` with **no mandatory `expect_fail`** —
>   verification's ONE-table cell ("the outcome IS the lesson") wins;
>   `late_apex`/`out_in_out` survive only as expected-in-practice evidence in §5's
>   mechanism column, never as pins.

Closes review §2.4 (the catalogue exists nowhere; Tier-1R re-derivations unwritten;
`sight_vs_stopping`/`stop_within_sight` id collision; `slow_steer` fails no check),
§8.2 (rubric identity), §9 item 12 (the vacuous outcome/check branch), the fig-8.6
finding that the chain-aware checks do not exist, and — via the outcome refactor in
§1 below — the §4 finding that "contained, not clean" has no outcome value.

Everything here is one coherent mechanism: **physics decides `outcome`; the rubric
pack decides `doctrine`; `quality` (and therefore colour, D9) composes the two.**
The catalogue is the shipped default pack, `parks-street/2`.

---

### 1. One definition of the outcome/check relationship (colour-law coherence)

**The defect.** 02 §7 defines `clean` = "all checks pass" and `violation` = "stayed
contained but failed doctrine", making them exhaustive over contained lines — so
06 §5.1's branch "outcome = clean with failed checks" is vacuous (review §9.12).
Meanwhile 04 §5 calls a chained line "contained, not clean" but no such outcome
value exists, and 08 exits 3 on non-clean solves (review §4). Root cause: `outcome`
double-counts doctrine.

**The mechanism (recommended — "Option B", a user decision, §11).** Factor the two
concerns:

```
outcome — PHYSICS ONLY, closed set, precedence left to right:

  crash > runoff > wide > stopped > contained          (dnf-spec-error DELETED — LineRefusal + exit 4 replace it)

  crash      grip or lean ceiling exceeded (deadbanded, 02 §7)
  runoff     unrecovered departure: crossed the OUTER usable edge (f rising
             through 1 + eps_f_detect — the run_wide_detect event) with no
             feasible corrective, OR terminated off_road with no outward detect
             (inside-side physical departure; corrective null)
  wide       crossed the outer usable edge but a feasible corrective returns it
  stopped    v < v_floor_ms before road end (honest halt — new value, closes
             review §3 "'stopped' runs have no outcome class")
  contained  reached road end on the carriageway, none of the above
             (replaces clean AND violation)
```

`outcome` never reads a doctrine check. It is recomputed identically under any
rubric pack (property `P-OUTCOME-RUBRIC-FREE`, §10).

**Corridor-departure ownership (binding).** The departure predicates are owned by
the corrective-offroad section — `run_wide_detect` (its §1.2: outward-only, `f`
rising through `F_DETECT + eps_f_detect`), the corrective shot (its §1.4–§1.7),
and the physical `off_road` test (its §2.1: `|d| > lane_width_m`, either edge);
this section consumes their classification, never redefines it. Detection is
deliberately outward-only: an **inside**-corridor excursion (`f < −eps_f_detect`
while still on pavement — toward or across the centreline) never moves `outcome`.
It is check territory (`out_in_out`, `chain_containment`) unless and until the
physical edge is crossed, at which point `off_road` terminates the run and the
corrective section's §1.7 table classifies `runoff` (corrective null — no save is
defined for an inside departure). A line that dips inside and reaches road end on
pavement is `contained` with failed checks — quality `caution`, never
`wide`/`runoff`.

```
doctrine — the check vector graded by the loaded rubric pack (§4–§6):
  doctrine.fail = count of checks with verdict "fail"

clean — a DERIVED PREDICATE, no longer an outcome value:
  clean(line) ⇔ outcome = "contained" ∧ doctrine.fail = 0
  Verdict.ok ≡ clean(line).  "Non-clean solve exits 3" (08) keeps its meaning verbatim.

quality — the single total colour function (06 §5.1 is REPLACED by this):
  quality(verdict) =
      "failing"    if outcome ∈ {crash, runoff, wide}
                     OR any critical-severity check failed   (merged: misjudgment v2.1 arm,
                                                              contingent on U1 = Mechanism A)
    | "good"       if outcome = contained ∧ doctrine.fail = 0
    | "caution"    if outcome = contained ∧ doctrine.fail > 0
    | "caution"    if outcome = stopped            (on-road, honest, not the taught line)
  good → green #1f6f43 · caution → amber #b07d1e · failing → red #b32e2e (palette carried)
  (quality tier word "contained" renamed "caution" — homonym fix vs the outcome value.)
  Refused lines draw nothing: they are LineRefusal envelope entries (dnf-spec-error is
  deleted; runtime spec errors are exit 4 INTERNAL).
```

Every branch is reachable; `quality` is total over the closed set (`P-QUALITY-TOTAL`).
The chained-line story now closes without a carve-out: a chained line's outcome is
`contained`; under chain-mode applicability (§5) its checks pass; `quality = good`
→ green; `solve` exits 0. The three irreconcilable statements of review §4 become
one law.

**Fallback ("Option A", if the owner declines the vocabulary change):** keep
`clean | wide | runoff | violation | crash`, define `outcome` computed AFTER the
doctrine suite with `clean ⇔ contained ∧ fail = 0`, `violation ⇔ contained ∧
fail > 0`, and delete 06's vacuous branch. Everything else in this section is
unchanged, but `outcome` becomes pack-dependent, which is why B is recommended:
under B a rubric swap can never move an outcome pin, an exit-0 tier, or the
mistake oracle's outcome table.

**Placement.** 02 §7 outcome list (replaces the five bullet definitions and drops
"`clean` — all checks pass"); 05 §6.1 (replaces the `outcome`/precedence block);
06 §5.1 (replaces the `quality(lineResult)` mapping verbatim with the above);
08 §3.1 exit-0 row (`contained, wide, runoff, crash, stopped`); 01 §4.3 and 03 §7.1
mistake tables (`violation` → `contained` + expect_fail pins, §7 below). The
rename lands as one re-bless migration commit (09 §3.3 procedure).

---

### 2. Where the catalogue lives — ownership decision

**Decision: the catalogue is a new `01-scope-and-doctrine.md` Appendix A**
("Appendix A — The doctrine check catalogue (`parks-street/2`)"), normative for
ids, tiers, applicability, arithmetic, and thresholds. 05 §6.2 shrinks to the
*record shape* (`CheckResult`, `doctrine` block) plus a pointer.

Justification: the thresholds cite book passages (the late bar, the danger-zone
teaching, Rule #1) — that is doctrine content, and 01 is the doctrine document;
05 owning arithmetic would put book claims in a wire-contract doc. The circular
delegation dies by making exactly one doc normative:

- 01 §3 sentence "*check ids and arithmetic live with the verdict contract in
  `05-result-contract-and-inspection.md`*" → "*check ids, arithmetic, and
  thresholds are enumerated in Appendix A; `05` owns only the record shape.*"
- 05 §6.2 sentence "*The check content is doctrine and lives in
  `01-scope-and-doctrine.md`; this document pins the record shape and the id
  list*" → "*The catalogue — ids, tiers, arithmetic, thresholds — is
  `01-scope-and-doctrine.md` Appendix A, shipped as the `parks-street/2` rubric
  pack (§6.4); this document pins only the record shape.*" The indented
  "check ids (v2)" block in 05 §6.2 is deleted (superseded by Appendix A).

---

### 3. Shared measurement definitions (Appendix A preamble)

All checks read only the Sample/Event/analysis record — never the road model
directly, never the engine. Constants are `name = value units` with `TUNING`
unless book-cited. Station constants are **corner-relative** (fractions of the
corner's centreline arc length `L_c = r·sweep`), per the review's P0 direction;
the extract's absolute-metre constants are converted and marked.

```
Corner window      W_c = [s(turn_in event for c) , s(exit event for c, else corner end)]
Committed lean     phi_c = max |cmd_lean| over the first steering input run in W_c
steering_complete  first sample with |phi| ≥ 0.9·phi_c   (existing 05 event)
apex               argmin f over W_c (carried); apex_pct = 100·cumΔψ(apex)/total sweep of c
apexes             the recorded per-corner apex list corners[].apexes[] (misjudgment's
                   hysteresis detector: prominence ≥ APEX_PROMINENCE_F = 0.08, separation
                   ≥ APEX_MIN_SEP_M = 5.0 m — THE one detector; this file's former
                   touches/DA_RISE_F definition is deleted)
exit sample        the sample at the RECORDED exit event (corner-exit's heading-capture
                   deadband EPS_EXIT_DEG = 1.0°; EXIT_EPS_DEG/EXIT_LOOKAHEAD_FRAC are
                   deleted); for a chained corner (§5) the link station instead; for a
                   terminated line with no exit event, corner end
blind(c)           ⇔ at c's turn_in event, s_limit < s_end(c): the rider cannot yet see
                   the corner exit from the turn-in point (rider-eye, D4)
steering input     a maximal rising run of |cmd_lean| toward the corner's hand with rise
                   > SI_HYST = 1.5° (TUNING, carried) — measured on the COMMANDED channel,
                   so stand-up disturbances (phi_dot_su) and roll-on widening never count
                   as rider inputs, and the exit unwind (|cmd_lean| → 0) never counts
danger_dwell_s     per corner, units seconds, EVIDENCE ONLY: total time within W_c with
                   |phi| > phiReserve(mu_use) — the book's danger zone (02 §4's
                   reserve-vs-ceiling teaching; the mechanism note "long danger-zone
                   dwell" in 01 §4.3's slow_steer row is this quantity, measured). Sum
                   over maximal exceedance runs; each boundary crossing linearly
                   interpolated between its two bracketing samples (the same
                   bracketed-crossing rule as the event brackets and below_validity_s).
                   Recorded in corners[].danger_dwell_s (§9), in-hash like every verdict
                   field; feeds NO parks-street/2 check (lean_ceiling grades the peak;
                   this records the exposure time)
```

The commanded-channel rule is the load-bearing Tier-1R re-derivation: v1 counted
humps of delivered `|phi(s)|`, which under the run-wide slice would count a chop's
stand-up as a "steering input". v2 checks grade *rider intent* on `cmd_lean` and
*physics* on delivered fields, each where it belongs. This is only possible
because 05 records commanded controls per sample — the check suite is the first
consumer that needs them.

---

### 4. The catalogue: `checks_version: 2`, pack `parks-street/2` — 16 checks, closed set

Severity vocabulary (merged; replaces the binary tier): `advisory` (worst verdict is
`warn`; never blocks green) | `standard` (≡ the old `gate`: a `fail` blocks green and
trips exit-3 under `--gate`) | `critical` (a `fail` additionally renders
`failing`/red without physical departure — misjudgment's Mechanism A arm; sole v2
critical = `wrong_strategy_for_corner`, contingent on owner decision U1). Scope:
`corner` | `pair` | `chain` | `line`. Every check may return `na` with a typed reason
(placard policy); `na` never blocks green. In the table below, rows marked `standard`
were `gate` in the draft.

| # | id | scope | severity | one-line claim | carried/new |
|---|---|---|---|---|---|
| 1 | `late_apex` | corner | standard | apex past the corner-type late bar | carried |
| 2 | `out_in_out` | corner | standard | enter wide, touch inside, exit wide (chain-modified §5) | carried |
| 3 | `single_input` | corner | standard | one steering input per corner (commanded channel) | carried, re-derived |
| 4 | `quick_steer` | corner | **standard** | roll-in must not eat the corner (two-sided ladder) | carried, **advisory→gate** |
| 5 | `throttle_rule` | corner | standard | crack → v_min ≤ apex → roll-on, no chop | carried, chop leg re-keyed |
| 6 | `trail_brake_taper` | corner | standard | brake past turn-in must taper below stand-up authority | carried, re-derived |
| 7 | `traction_ceiling` | corner | standard | never beyond the friction ellipse | carried |
| 8 | `lean_ceiling` | corner | standard | reserve / ceiling three-band ladder | carried |
| 9 | `exit_containment` | corner | standard | exit lane fraction < 1 | carried |
| 10 | `stop_within_sight` | line | standard | ssd(v, phi, …).ssd_m ≤ sight_ride_m at every station | carried, **renames** `sight_vs_stopping` (§6) |
| 11 | `hold_wide_for_sight` | corner | standard | on a blind corner, stay wide until release | new (v2, D4) |
| 12 | `rideability` | line | standard | no tracker overdrive / kinematic teleport | carried, su-compensated |
| 13 | `link_continuity` | pair | standard | each exit sets up the next entry | carried, re-derived |
| 14 | `chain_containment` | chain | standard | the whole chain stays in the corridor | **new** |
| 15 | `chain_flow` | chain | standard | one rhythm through the sequence | **new** |
| 16 | `wrong_strategy_for_corner` | corner | **critical** | ≥ 2 measured apexes on a decreasing-radius corner not declared double-apex; warn branch when blind-at-commitment ∧ significantly slower (fig 8.4 caption) | **new** — misjudgment owns the arithmetic; sole v2 critical (contingent U1 = Mechanism A) |

#### Per-check arithmetic

**1. `late_apex`** — classify `apex_pct` by corner radius trend:
increasing-radius → `na` (book: apex comes earlier; carried); decreasing-radius →
pass iff `apex_pct > 60` (book-cited, STANDARD §3); constant-radius (incl. hairpin)
→ pass iff `apex_pct > 50` (book-cited). Declared `style=double_apex` corners:
evaluate the **final** touch (exit discipline still governs). Fail cites
`{apex_pct, bar}`. Applies per corner in chains (this is how chained `premature`
compounds are caught — fig 8.6).

**2. `out_in_out`** — with `ti_f = f(turn_in)`, `apex_f = f(apex)`, `exit_f =
f(exit sample)` (per-corner hand-relative `f`):
pass iff `ti_f ≥ OIO_OUTSIDE_MIN (0.55 TUNING) ∧ apex_f ≤ OIO_INSIDE_MAX (0.45
TUNING) ∧ exit_f ≥ OIO_OUTSIDE_MIN ∧ max(ti_f, exit_f) − apex_f ≥ OIO_SWING_MIN
(0.4 TUNING)`. Declared double-apex: `apex_f` = min over `apexes[]`. **Chain-mode
corners (§5): the two exit legs are waived** — pass iff `ti_f ≥ 0.55 ∧ apex_f ≤
0.45`, evidence noting "exit leg waived (chained)". Requires the exit sample to
exist, which requires lean-unwind (§2.1 cluster dependency); until termination, a
runoff line grades this check on the samples that exist and typically fails the
exit leg.

**3. `single_input`** — count steering inputs (§3 definition) in `W_c`.
Single-apex corner: pass iff count = 1; fail at 2 ("the second bite"); count ≥ 3
always fails as fifty-pencing **regardless of any declaration** (carried
anti-gaming rule). Declared `style=double_apex`: pass iff count ≤ 2. (The draft's
"corrective-shot lean-add counts as an input" clause is DELETED — the corrective is
a branched shadow per corrective-offroad; shadow inputs never appear on the graded
line's commanded channel.)

**4. `quick_steer` — the two-sided re-derivation that makes `slow_steer` fail a
check.** v1 measured only ramp seconds and could only WARN; geometry-blind and
toothless. v2 measures **corner real estate eaten by the roll-in**:

```
dt_steer    = t(steering_complete) − t(turn_in)                        [s]
steer_share = max(0, s(steering_complete) − max(s(turn_in), s0_c)) / L_c    [—]

fail  iff steer_share > QS_SHARE_FAIL = 0.45   (TUNING)
warn  iff steer_share > QS_SHARE_WARN = 0.30   (TUNING)
        or dt_steer > QS_TIME_WARN = 1.0 s     (TUNING, carried bar, now warn-only leg)
pass  otherwise
na    iff phi_c < SMALL_LEAN_DEG = 3.0°        (TUNING, carried — no real steering event)
```

*Worked on fig 8.2's parameters (`book90`: R 12 m, sweep 90°, `L_c` = 18.85 m,
entry 34 km/h, solved turn-in speed ≈ 30 km/h = 8.33 m/s, line radius ≈ 15 m →
`phi_c = atan(8.33²/(9.81·15)) ≈ 25.2°`):*
- good line, `street` 50°/s: `dt_steer ≈ 25.2/50 = 0.50 s` → distance ≈ 4.2 m →
  `steer_share ≈ 0.22` → **pass** (margin 0.08 below warn);
- `slow_steer` ×0.3 → 15°/s: `dt ≈ 1.68 s` → ≈ 14.0 m → `share ≈ 0.74` → **fail**
  (0.29 above the bar);
- even a gentler compiler re-tune ×0.45 → 22.5°/s: `dt ≈ 1.12 s` → ≈ 9.3 m →
  `share ≈ 0.50` → **fail**. The check is robust to the mistake-compiler
  cluster's expected `roll_rate_factor` retune, and a `casual` rider genuinely
  too slow for this corner fails it too — which is the doctrine.

**5. `throttle_rule`** (Keith Code Rule #1) — four legs over `W_c`, graded on the
*commanded* channel where intent matters:
(a) *crack*: some sample with `cmd_a ∈ [0, THR_EPS = 0.05 m/s²]` at/before apex
and not earlier than `s(steering_complete) − CRACK_EARLY_FRAC·L_c`
(`CRACK_EARLY_FRAC = 0.6` TUNING; converts extract's absolute 12 m) → miss = warn;
(b) *v_min at/before apex* → miss = fail;
(c) *roll-on onset* ≤ `s(apex) + ROLLON_LATE_FRAC·L_c` (`ROLLON_LATE_FRAC = 0.6`
TUNING; converts 12 m) → miss = warn;
(d) *post-onset discipline* → miss = fail: from onset to exit `dv/ds ≥ −0.1
(m/s)/m`; **no chop** — no sample after `steering_complete` with `|phi| ≥
SMALL_LEAN_DEG` and `−cmd_a_rate > RATE_THRESHOLD = 8.0 m/s³` (the SAME constant
that fires 02 §5.2's transient stand-up: check and physics key on one trigger, so
the check fails exactly when the slice fires — the chop-keyed re-derivation 05
mandated); no sustained mid-corner brake `cmd_a < −CHOP_TOL = −0.5 m/s²` after
`steering_complete` **except** samples whose `action_id` is the entry brake action
(those are trail-brake territory and graded by check 6 — the recorded `action_id`
makes the split mechanical, not heuristic).

**6. `trail_brake_taper`** — Tier-1R re-derivation (05 mandated it; written
nowhere until now):
```
na    iff entry braking completes ≥ brake_gap (4 m, 04's constant) before turn_in (the baseline)
fail  iff at any sample with |phi| ≥ TB_PHI_MIN = 15° (TUNING):
          −a_long > a_widen(phi, v)        — braking hard enough to FORCE stand-up
      or  brake re-deepens after its peak by > REDEEPEN_TOL = 0.3 m/s² (TUNING, carried)
warn  iff residual decel at apex > RESID_FRAC = 0.35 (TUNING, carried) × peak decel
      or  any leaned sample has −a_long ∈ (A_SU_ONSET = 2.5 m/s², a_widen(phi, v)]
          — legal but eating roll authority ("ate the stand-up reserve")
pass  otherwise — the taper is exactly the advanced skill the book photographs
```
`a_widen(phi, v)` is the geometric widening threshold from the run-wide slice
re-derivation — **owned by the runwide-physics cluster (02 §5.4)**; this check
consumes it by name and must not restate its formula. Delivered `−a_long` is used
(load transfer follows what the tire does), commanded rate is check 5's business.

**7. `traction_ceiling`** — fail iff `ellipseMag > 1 + eps_mag (1e-3)` at any
sample of `W_c`, or a `crash` event lies in `W_c`. Physical μ only (one-μ policy,
carried verbatim).

**8. `lean_ceiling`** — with `reserve = phiReserve(mu_use)` capped at
`BLIND_RESERVE_DEG = 35°` (TUNING, carried) when `blind(c)`; `ceiling = phiMax(mu)`:
pass iff `phi_max ≤ reserve`; warn iff `≤ ceiling` ("ate the reserve"); fail
beyond (lowside; crash outcome will co-occur). Carried three-band ladder.

**9. `exit_containment`** — pass iff `f(exit sample) < 1.0`. Chain-mode corner:
evaluated at the link station. If the line terminates off-road before the exit
sample exists (`off_road` termination, §2.3 cluster), fail citing the crossing
station. Carried.

**10. `stop_within_sight`** (line scope; id resolution §6) — at every sample:
```
deficit(s) = ssd(v, phi, model, profile, mu).ssd_m − sight_ride_m          [m]
fail  iff max deficit > 0            (cites worst station, v, phi there)
warn  iff min margin < SIGHT_WARN_M = 5 m (TUNING)
pass  otherwise
na    iff the scenario carries the vertical-blindness placard (01 §8)
```
`ssd` (four-part return; the check reads `.ssd_m` with the sample's own `phi`) is the lean-aware stopping model — **owned by the runwide-physics
cluster** (it resolves the 7.0 m/s²-vs-`a_noreturn` contradiction); this check
consumes it by name. The sight/ssd path-metric mismatch (review §9.4) is RESOLVED by
bug-sheet 9.4: this check compares against the recorded `sight_ride_m` (rider-path
lookahead); `sight_m` remains the comparability/render channel.

**11. `hold_wide_for_sight`** (new, D4) — the doctrine "hold wide to open the
sight line", now with arithmetic:
```
na unless blind(c).
release(c) = first station where trend = "opening" ∧ sight_ride_m ≥ ssd(v, phi, model, profile, mu).ssd_m
window(c)  = [ s(turn_in) − HOLD_WINDOW_FRAC·L_c , s(turn_in) ]   (HOLD_WINDOW_FRAC = 0.75 TUNING)
fail iff  s(turn_in) < release(c) − RELEASE_TOL_M (2.0 m TUNING)      — committed while closing
      or  min f over {samples in window with trend ≠ "opening"} < HOLD_F_MIN (0.7 TUNING)
warn iff  that min f ∈ [HOLD_F_MIN − 0.15, HOLD_F_MIN)                — drifted in early
pass otherwise
```
The check bar (0.7) is deliberately looser than the solver knob default
(`vis_hold_f = 0.9`): the solver aims high; doctrine enforces a floor. Grades any
line — solver-authored, explicit-plan, or mistake — from recorded per-sample
fields only.

**12. `rideability`** — Tier-1R re-scope (fixes the review's P-ROLLRATE
contradiction at the check layer): fail iff
`|phi_dot − phi_dot_su| > roll_rate + RATE_TOL_DPS (2.0°/s TUNING, carried)`
anywhere — the **tracker component** may never exceed its cap; the stand-up
disturbance is physics and is subtracted before judging. Requires `phi_dot_su`
per sample (§9; shared with the runwide cluster). Also fail on `|Δkappa| >
KAPPA_STEP (0.01 1/m)` between adjacent retained samples or `|Δphi| > PHI_JUMP
(3.0°)` at `Δt → 0` (carried teleport guards).

#### The chain-aware set (13–15) — these existed only as six words; full arithmetic

**Applicability — ONE rule, emergent, answering "which lines are graded
chain-aware":**

```
geometric chain pair (c, c+1):  connecting straight ≤ LINK_GAP_FRAC ×
                                min(L_c, L_{c+1})       (LINK_GAP_FRAC = 1.0, TUNING)
ridden-linked pair:             geometric pair AND peak −cmd_a on the connecting span
                                ≤ LINK_BRAKE_RESET = 1.0 m/s² (TUNING, carried)
chain-mode corner:              a corner with a ridden-linked successor
```

By road *measured geometry* plus the line's *own riding* — never by solver kind,
role, or corner count. An explicit-plan line on `bookEsses` is graded chain-aware
iff it actually rides the corners linked; a rider who brake-resets a zero-gap ess
loses the exemptions AND fails `link_continuity`. Chain-mode consequences on
per-corner checks: `out_in_out` exit legs waived (check 2); `exit_containment` at
the link station (check 9); `late_apex`, `single_input`, `quick_steer` unchanged
per corner.

**13. `link_continuity`** (per geometric pair; `na` if the road has none) — three
legs, fail if any:
(a) *entry side*: corner c+1 entered from its outer half — `f(entry of c+1) ≥
LINK_ENTRY_OUTER_MIN = 0.5` (TUNING, carried) in c+1's hand-relative frame;
(b) *no brake reset*: peak `−cmd_a` on the connecting span ≤ `LINK_BRAKE_RESET`
(a reset on a geometric pair is a flow failure — "think more than one corner
ahead");
(c) *one flick*: the `|cmd_lean|` series over the connecting span has ≤ 1 local
extremum beyond `SI_HYST` (alternating hands: exactly one minimum — the flick;
same hand: none). ≥ 2 extrema = inter-corner fifty-pencing.
Note the trajectory is one integration, so the extract's d/heading "gap"
continuity is true by construction and is dropped from the arithmetic — the v2
legs grade what can actually vary.

**14. `chain_containment`** (chain scope; `na` unless the line has ≥ 1 chain-mode
corner) — over the chain span (first chained corner's turn-in to last corner's
exit sample): pass iff `max f ≤ 1 + EPS_F` and `min f ≥ −EPS_F` (`EPS_F = 0.02`
TUNING). Fail cites the worst station and side. This is the "contained" half of
04 §5's "containment + link-continuity + flow", as a check with teeth.

**15. `chain_flow`** (chain scope; same applicability) — three legs, fail if any:
(a) *slow-in per corner carried through the chain*: each chained corner's `v_min`
at/before its apex station;
(b) *gap throttle discipline*: on each connecting span, `cmd_a` crosses zero at
most once (no roll-on-then-grab);
(c) *rhythm*: the number of sign changes of `cmd_lean` (with `|cmd_lean| ≥
SMALL_LEAN_DEG` on both sides) over the chain span equals the number of hand
alternations in the ridden corner sequence — exactly the flicks the road demands,
no extra wobbles.

#### Special-case `na`/exemption table (one place, normative)

| Special case | Effect on catalogue |
|---|---|
| increasing radius | `late_apex` → `na` (carried) |
| decreasing radius | `late_apex` bar 60 % (carried, book-cited) |
| declared `style=double_apex` | `single_input` tolerates 2; `late_apex` grades final touch; `out_in_out` uses min-touch `apex_f`; ≥ 3 inputs still always fail |
| blind corner (`blind(c)` predicate) | `lean_ceiling` reserve capped 35°; `hold_wide_for_sight` becomes applicable |
| chain-mode corner | `out_in_out` exit legs waived; `exit_containment` at link station |
| vertically-blind scenario | `stop_within_sight`, `hold_wide_for_sight` → `na` with placard reason |
| non-chain road | 13–15 → `na` ("no linked pair on road") |

Applicability keys read *declared style* and *measured geometry* only — never
role, never colour (D9 direction preserved: verdict drives colour, labels drive
nothing).

---

### 5. Every mistake kind fails at least one check (coverage proof + oracle pins)

Under the arithmetic above, on the named oracle fixtures (fixture naming closes
review §7's "oracle base scenarios unspecified" for this cluster's slice; final
pin reconciliation is shared with the mistake-compiler cluster):

| kind | fixture | outcome pin | `expect_fail` pin | why it fails (mechanism) |
|---|---|---|---|---|
| `premature_contained` | `book90` | `contained` | `[late_apex]` | early turn-in, deferred target → apex_pct ≪ 50; kisses inside so `out_in_out` may pass — the pin is the one check that IS the lesson |
| `premature` | `book90` | `runoff` | `—` (conformed to the normative 03 §7.1 cell — the outcome IS the lesson) | committed early lean → early apex + never re-enters the outside-inside-outside shape; `late_apex`/`out_in_out` fail in practice (coverage evidence, not pinned) |
| `slow_steer` | `book90` | `runoff` | `[quick_steer]` | steer_share ≈ 0.74 > 0.45 (arithmetic in §4 check 4) — **the defect "slow_steer fails no check" is closed** |
| `fifty_pence` | `book90` | `wide` (merged — verification's owner-framed cell wins) | `[single_input]` | 6 facets → ≥ 3 commanded inputs, always-fail rule |
| `chop` | `book90` | `runoff` | `[throttle_rule]` | commanded-rate chop leg keys on `RATE_THRESHOLD`, the same trigger as the physics stand-up |
| `overspeed` | `bookDecreasing` | `runoff` | `[out_in_out]` | same committed lean at +26 km/h → larger radius → never reaches the inside (`apex_f > 0.45`); note `a_lat = G·tanφ` is speed-free, so traction/lean checks correctly do NOT fire — the diagnosis channel (`overspeed_entry`) names the cause, checks grade the ridden line |
| chained variants (`scope: all_corners`) | `bookEsses` | `contained`→`runoff` by kind | per-kind pin + `[link_continuity]` where the compound breaks the entry side | fig 8.6 device |

Considered and rejected: a new `entry_speed` check. Cause attribution is the
`diagnosis` channel's job (`overspeed_entry` exists); a check would need a
counterfactual solve to know "too fast", violating the checks-read-the-record
rule. Documented in Appendix A so the question stays answered.

---

### 6. The id collision, resolved

**Decision: the v2 id is `stop_within_sight`; `sight_vs_stopping` is retired with
a typed tombstone.** Rationale: the three design-of-record docs that reference
the check (05, 06, 09) all already say `stop_within_sight`; only extract/ says
`sight_vs_stopping`, and disk state wins over extract. 05 §6.2's "the check *ids*
are stable" is rescoped to "stable **within** a `checks_version`" — v1→v2 is
precisely where a rename may happen, and the pack records it:

- Pack manifest carries `renames: { "sight_vs_stopping": "stop_within_sight" }`.
- `validate` rejects `expect_fail: ["sight_vs_stopping"]` (and `explain
  sight_vs_stopping`) with `UNKNOWN_ID` whose message names the successor:
  `"sight_vs_stopping was renamed to stop_within_sight in checks_version 2"` —
  loud, typed, D8-conformant; never silently aliased.

Placement: 05 §6.2 replacement text (§2 above) states the rescoped stability
rule; Appendix A lists the rename; 09 gains `A-RENAME-REJECTED` (§10).

---

### 7. Rubric identity (review 8.2): the catalogue as a declared data pack

#### 7.1 The identity field

Every `Verdict` carries `rubric: "<name>/<version>"` — shipped default
`"parks-street/2"`. `checks_version` is **retained with a changed, precise
meaning**: it versions the *metric vocabulary* (the code); `rubric` versions the
*bindings* (the data). The two answer different questions: "which measurements
exist" vs "which thresholds/severities/applicability grade them".

#### 7.2 Pack shape — what is data, what is code

```
RubricPack = {
  pack: "linelab-rubric/1",              // pack wire-format version
  name: "parks-street",                  // identity; rubric string = "<name>/<version>"
  version: 2,                            // integer; bump on ANY binding change
  requires_checks_version: 2,            // metric vocabulary this pack binds against
  doctrine_source: "Parks, Total Control, ch. 8–9",
  checks: [ {
    id,                                  // closed id set OF THE PACK
    metric,                              // one of the engine's closed metric ids (code)
    scope: "corner"|"pair"|"chain"|"line",
    severity: "advisory"|"standard"|"critical",   // merged (was tier: gate|advisory; gate ≡ standard)
    applicability: { … },                // declarative keys: corner_trend, requires_blind,
                                         // declared_style, chain_mode — the closed key set
                                         // is code; the values bound here are data
    thresholds: { NAME: {value, units, source: "book:<cite>"|"TUNING"} … },
    severity: { … },                     // metric-band → pass|warn|fail mapping
    teaches, book_ref                    // explain() text
  } ],
  renames: { old_id: new_id }            // tombstones (§6)
}
```

**Code (versioned by `checks_version`):** the metric implementations —
`apex_pct`, `oio_fractions`, `input_count`, `steer_share`, `throttle_legs`,
`taper_profile`, `ellipse_max`, `lean_max`, `sight_deficit`, `hold_wide_legs`,
`tracker_overdrive`, `link_legs`, `chain_extent`, `flow_legs` — a closed metric
vocabulary, pure functions of (samples, events, analysis).
**Data (versioned by the pack):** which ids exist, which metric each binds,
thresholds, bands, severity, applicability values, prose.
A pack **cannot introduce arithmetic**; wanting a new metric = a `checks_version`
bump (code change, re-bless migration). This is what makes the seam safe: two
implementers loading the same pack against the same `checks_version` must
converge, because everything interpretive is data and everything computational
is pinned code.

#### 7.3 Selection, validation, and what changes when a different pack loads

- Packs are committed data files (`plan/doctrine/packs/parks-street.json` in the
  module map's `plan/`), hashed like fixtures. v1 ships exactly one.
- Selection surface: `config.rubric?: "<name>"` (scenario wire schema, default
  `"parks-street"`), CLI `--rubric <name>`, scene key `rubric: <name>`. Version
  is not author-selectable: the engine resolves a name to the single version it
  ships (skew across engine versions is the share-URL cluster's stamp).
  Unknown name → `UNKNOWN_ID`. `requires_checks_version` mismatch → `SCHEMA`
  (message naming both versions). One rubric per figure (like one road): lines
  disagreeing → `SCHEMA` (`rubric_mismatch`); the FigureSpec carries the figure's
  rubric string as an *input* (shareable; consumers regrade under the same pack).
- **When a different pack loads, exactly this changes:** the `doctrine` block,
  `quality`/colour, gate/exit-3 behaviour, `expect_fail` id resolution, `explain
  <checkId>` content, and `result_hash` (verdict content changed, and `rubric`
  is inside the hash). **Never changes:** samples, events, `terminated`,
  `outcome`, `spec_hash` — pinned by `P-OUTCOME-RUBRIC-FREE` (§10). Under
  Option B this holds by construction; under fallback Option A it cannot, which
  is the strongest argument for B.
- **"The book wins" stays the shipped default**: `parks-street/2` encodes the
  brake-complete baseline, `trail_brake_taper`'s `na`-when-baseline, and the
  book-cited bars. The Ch. 9 trail-braking dispute (review 8.2) becomes a future
  `trailbrake-street/1` pack — a data file, not a fork; the review's verifier
  note (the taper check already grades taper quality) is honoured: nothing in
  the default pack paints a competent taper red.

---

### 8. Placement summary (doc → edit)

| Doc | Edit |
|---|---|
| 01 | New **Appendix A** = §3–§6 of this section (catalogue, exemption table, pin table, rename); §3 delegation sentence replaced (§2); §4.3 table outcome column: `violation` → `contained`, add `expect_fail` pin column |
| 02 | §7 outcome block replaced (§1); §5.4 gains the cross-ref that `RATE_THRESHOLD` is shared by check 5 (one trigger, stated once) |
| 03 | §6 config gains `rubric?`; §6.2 note: check ids in `expect_fail` validated against the loaded pack (`UNKNOWN_ID`); §7.1 outcome pins re-pointed at §5's fixture table |
| 04 | §5 "contained, not clean" sentence now names the outcome value and points at chain-mode applicability (§4 here) instead of the six-word check list |
| 05 | §6.1 replaced (§1); §6.2 replaced by record shape + pointer (§2); §6.3 verdict shape delta (§9); §2.1 Sample gains `su_sustained`/`su_transient` (merged split; `phi_dot_su` ≡ their sum, §9) |
| 06 | §5.1 mapping replaced by `quality` law (§1); legend prints quality word + role (enables the pedagogy cluster's amber-disambiguation) |
| 08 | §3.1 exit-0 row reworded; `--rubric` added to §4.1 flag set; `schema` sections list gains `rubric`; `explain <checkId>` sources pack prose |
| 09 | §3.4 gains `P-QUALITY-TOTAL`, `P-OUTCOME-RUBRIC-FREE`; §4 gains the pin table + new acceptance tests (§10) |

---

### 9. Contract impact (exact shapes)

```
Sample   +=  su_sustained, su_transient : number [deg/s]   // merged split (pov-samples wins);
                                              // phi_dot_su ≡ su_sustained + su_transient is
                                              // defined notation — this file's formulas read the
                                              // sum. Stand-up disturbance actually applied this
                                              // sample; linear interpolation; SHARED surface —
                                              // the runwide cluster also requires it (review §6);
                                              // one field, one name, appended per 05 §2.2

Verdict  =   { ok,                            // ≡ quality == "good"
               spec_hash, result_hash,
               checks_version: 2,             // metric vocabulary (code)
               rubric: "parks-street/2",      // pack identity (data) — NEW
               engine, outcome,               // outcome per §1 closed set
               quality: "good"|"caution"|"failing",   // NEW, stored, in-hash (merged words)
               headline, diagnosis,
               corners: [ … , turn_ins: […], apexes: [{s, pct, f, clearance_m, v_kmh,
                                              // lean_deg}], danger_dwell_s ],  // merged shape —
                                              // misjudgment owns the reshape; `touches` retired;
                                              // danger_dwell_s NEW measurement (evidence only;
                                              // arithmetic §3 — reserve-exceedance dwell)
               sight, constraints,
               doctrine: { pass, fail, warn, na, checks: [CheckResult] } }

CheckResult = { id,
                scope: "corner"|"pair"|"chain"|"line",
                corner_id: string|null,       // scope=corner
                pair: [string,string]|null,   // scope=pair
                verdict: "pass"|"fail"|"warn"|"na",
                evidence: { message, at_s?, metrics? } }   // typed; v1's bare string retired
```

Wire/grammar tokens added (all three spellings): JSON `config.rubric` · CLI
`--rubric <name>` · scene `rubric: <name>`. Typed errors added (existing codes,
new reasons): `UNKNOWN_ID` (`unknown_check_id`, `unknown_rubric`,
`renamed_check_id` with successor), `SCHEMA` (`rubric_incompatible`,
`rubric_mismatch`).

---

### 10. Acceptance (09 gains)

- **`A-CATALOGUE-RESOLVES`** — every check id referenced anywhere in the repo
  (fixture `expect_fail`s, oracle pins, goldens' check vectors, `explain`
  registry, docs' fenced id mentions collected in one committed list) resolves
  against the shipped pack; the pack's id set equals Appendix A's 16 exactly.
- **`A-CATALOGUE-EXERCISED`** — every one of the 16 ids has ≥ 1 committed fixture
  where it *fails* and ≥ 1 where it *passes* (a check that cannot fail is dead
  doctrine — D8's spirit at the catalogue level).
- **`A-MISTAKE-FAILS-CHECK`** — for every mistake kind on its §5 fixture, the
  compiled line's failed-check set ⊇ its `expect_fail` pin and outcome matches
  the pin (the pin = the normative 03 §7.1 mandatory cell; where that cell is
  empty the ⊇ clause holds vacuously and the row asserts outcome only);
  explicitly includes `slow_steer` → `quick_steer` FAIL on `book90`.
- **`A-QS-TWOSIDED`** — `book90` good line passes `quick_steer` with
  `steer_share ≤ 0.30`; the `slow_steer` compile fails it — the two-sided ladder
  pinned from both sides.
- **`A-CHAIN-GREEN`** — the `bookEsses` `chainedSolve` line grades
  `outcome = contained`, checks 13–15 pass, per-corner checks pass under
  chain-mode, `quality = good` (green) — the review §4 contradiction, as a test.
- **`A-RENAME-REJECTED`** — `expect_fail: ["sight_vs_stopping"]` →
  `UNKNOWN_ID` naming `stop_within_sight`.
- **`A-RUBRIC-STAMP`** — every verdict carries `rubric`; recompute under the
  same pack reproduces `result_hash`.
- **`A-DANGER-DWELL`** — the `lean_ceiling`-fail fixture required by
  `A-CATALOGUE-EXERCISED` (its line necessarily dwells beyond
  `phiReserve(mu_use)`) pins `corners[].danger_dwell_s` to the
  bracketed-interpolated exceedance time (§3's definition) within numeric
  tolerance; C30's clean run records `0.0` on every corner.
- **`P-QUALITY-TOTAL`** (property) — `quality` is defined and single-valued for
  every value of the outcome closed set × any doctrine fail count.
- **`P-OUTCOME-RUBRIC-FREE`** (property) — on fuzzed scenarios, grading under a
  threshold-perturbed variant pack changes only `doctrine`/`quality`/
  `result_hash`; samples, events, `outcome`, `spec_hash` byte-identical.
- **Golden `G-C30-CHECKVECTOR`** — C30's clean run pins the full 16-id vector
  (13–15 `na` on a single corner; 11 `na` non-blind; 16 `na` non-decreasing; the
  rest pass).

---

### 11. Decision drafts + user decisions

**New decision drafts (editor numbers them):**

1. **"One outcome law: physics decides outcome, the rubric decides doctrine,
   colour composes them."** Outcome becomes the physics-only closed set
   `crash > runoff > wide > stopped > contained`; `clean` becomes the derived
   predicate `contained ∧ zero failed checks`; `quality` is the single total
   colour function. Kills the vacuous branch (review §9.12), gives 04's
   "contained" a value, gives stopped runs a class, and makes rubric packs
   unable to move physics classifications.
2. **"The doctrine rubric is a declared data pack; the book wins as the shipped
   default."** Check bindings (ids, thresholds, severities, applicability) are
   data (`parks-street/2`); metrics are code (`checks_version`). Every verdict
   names its rubric. Future doctrine disputes are packs, not forks.
3. **"The check catalogue is owned by 01 Appendix A; 05 owns only the record
   shape"** — ends the circular delegation; includes the `quick_steer`
   advisory→gate promotion with geometry-normalized arithmetic (the fix that
   makes `slow_steer` fail a check) and the v2 rename
   `sight_vs_stopping → stop_within_sight` with a typed tombstone.

**User decisions (owner must rule):**

1. *Outcome vocabulary*: adopt Option B (physics-only set; `contained` replaces
   `clean`+`violation`; add `stopped`) — **recommended**, because it is the only
   variant under which `P-OUTCOME-RUBRIC-FREE` can hold and the §4
   chain/exit-code contradiction dissolves structurally — or Option A (keep the
   carried five-word set, delete the vacuous branch, accept pack-dependent
   outcomes). B touches more sentences (02 §7, 05 §6.1, 06 §5.1, 08 §3.1,
   01/03 mistake pins) in one re-bless commit; A is smaller but leaves the
   rubric seam able to flip outcome pins.
2. *Rubric selectability in v1*: ship `config.rubric`/`--rubric` now with
   exactly one legal value (**recommended** — the seam costs one field and one
   validation path, and D8 is satisfied since the field names the pack the
   verdict provably used), or stamp `rubric` in verdicts only and add the
   selector when a second pack exists.

**Dependencies on parallel clusters (consumed by name, not restated):**
`ssd(v, phi, model, profile, mu)` and `a_widen(phi, v)` and the `su_sustained`/`su_transient` sample fields (`phi_dot_su` ≡ their sum) —
runwide-physics cluster; corrective-shot predicate (wide/runoff boundary my
outcome set consumes) — §2.2 cluster; `off_road` termination stations cited by
checks 9/14 — §2.3 cluster; lean-unwind making the exit sample exist — §2.1
cluster; final mistake-oracle pin reconciliation and `roll_rate_factor` retune —
mistake-compiler cluster (my `quick_steer` bar is robust to it, shown in §4);
`--gate`/`expect_fail` exit wiring over mixed envelopes — agent-interface
cluster (my `quality` field is the input it needs); legend quality-word printing
— pedagogy cluster.
