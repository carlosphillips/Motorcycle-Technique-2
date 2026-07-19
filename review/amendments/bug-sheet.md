## Consistency Bug Sheet (review §9, items 1–14)

> **EDITORIAL RECONCILIATION (binding) — 2026-07-19 editor pass.** Merged against the
> thirteen sibling amendment sections per the three reconciliation audits. Where the
> body below disagrees with a bullet, the bullet wins. Per this sheet's own
> subsumption flags, several of its floors retire to the owning clusters:
>
> - **9.12 outcome/fate split → SUPERSEDED** by doctrine-catalogue's Option B
>   (outcome = physics-only `crash>runoff>wide>stopped>contained`; refinement lives
>   in quality/`clean`-predicate; edited in place).
> - **9.11 phase half → pov-samples' five-token machine** (`approach|turning|
>   midcorner|exiting|done`); the `dnf-spec-error` deletion half WINS (exit 4
>   `INTERNAL` + `LineRefusal`, refusal keyed `line_id` not `name`).
> - **9.7 exit law → merged into agent-interface's one 08 §3.1 table** as the tier
>   structure (0/1/2/3/4, 4 = INTERNAL) + the figure/scene default-gated rule +
>   both-directions deviation wording; `A-EXIT-DECLARED` stands.
> - **9.8 → agent-interface's composed mistake token** ONLY (its `--corners` and
>   scene `scope=` retention lose; rejected with rewrite hints; edited in place).
> - **9.9 → agent-interface's schema wrapper**; this sheet's surviving content is
>   the `{admissible_outcomes, fixture_pin}` Kind rows (edited in place).
> - **9.2 pins re-keyed** per the rename + Option B on `F-ORACLE-90` (was
>   F-ORACLE-book90; book90 = left-hand default): `premature`→runoff,
>   `premature_contained`→contained+fails, `chop`→runoff (verification's cell wins;
>   contested — owner sign-off listed), `fifty_pence`→wide (+`single_input`).
> - **9.4 WINS project-wide** (`sight_ride_m` is the sole safety basis) and **9.3
>   respells `at_s:` → `s:`** (agent-interface's anchor grammar; edited in place).
> - **9.6's hash sentence respells**: result_hash = fnv1a(canonical verdict minus
>   {result_hash, diagnosis, cache, skew} + resolved plan); the retained record's
>   tripwire is P-DETERMINISM + the goldens, not the hash.
> - Kinds respelled in place; quality words `good|caution|failing`; outcome words
>   Option B throughout.

Scope: one resolution per bug — which statement wins, the exact replacement direction, vocabulary/typed-error additions, doc placement, contract impact, and 09 acceptance additions. Subsumption flags name the parallel cluster that likely owns the bigger mechanism; the resolution here is the floor that must survive even if that cluster misses the item. Three mechanisms below deliberately subsume several bugs each: the **fate/outcome split** (bugs 2, 11, 12), the **declaration-aware exit law** (bugs 7, 11), and the **one-basis sight comparison** (bug 4, feeding 5).

---

### 9.1 — Ride-line cardinality (04 §7 contradicts its own example)

**Winner:** the two-ride example, the subsequent-ride role rule, and the vis-compare figure (04 §6 explicitly authors `vis=none` vs `vis=cautious` in one figure). The "exactly one" parenthetical loses.

**Mechanism.** In 04 §7, replace the parenthetical on the `mistake` line-kind bullet:

> old: "(exactly one `ride` line is required — the reference every mistake is measured against)"
> new: "(**at least one** `ride` line is required; the **first** `ride` entry is the figure's *reference line* — every `mistake` compiles against it, `apex:<id>` label sugar resolves against its solved apex, and the one-perturbation rule perturbs it. Additional `ride` entries are unrestricted.)"

The existing role-default sentence ("first `ride` → `ideal`, subsequent `ride` → `alternative`") stands unchanged and now has referents. In 04 §9's carried list, restate "the one-`ride`-line scene rule" as "the **first-ride-is-reference** rule". Zero-ride scenes (only `mistake`/`naive`/`plan` entries) remain rejected with typed `SCHEMA` ("no reference line; a mistake needs a first `ride` entry to compile against").

**Placement:** 04 §7 (two sentences), 04 §9 (one phrase). **Contract impact:** none. **Acceptance (09):** `C-SCENE-MULTIRIDE` — 04 §7's own worked example (with `good:` and `wide:` rides plus `bad:` mistake) bakes; assert the mistake compiled against `good`, `wide` carries role `alternative`, and a zero-ride scene fails typed `SCHEMA`.

**Subsumption:** none (owned here). Interaction note: the misjudgment cluster's two-strategy authoring adds more line kinds; "at least one ride, first is reference" is permissive and composes.

---

### 9.2 — Two conflicting outcome-pin tables (01 §4.3 vs 03 §7.1) ⟨known overlap⟩

**Winner:** 03 §7.1 (it owns the compiler), restructured; 01 §4.3 becomes citing prose. "roll-rate-limited" is expelled from outcome cells — it is diagnosis vocabulary (05 §6.1 `roll_rate_limited`), never an outcome class.

**Mechanism.** 03 §7.1's outcome column splits into two normative columns:

1. **Admissible classes** — a *set* drawn from the closed outcome enum (05 §6.1, as revised by 9.12 below). Engine outcome outside the set on any conforming road = red suite.
2. **Fixture pin** — exactly **one** class, pinned on the named canonical fixture `F-ORACLE-90` (= `book90` preset, entry 34 km/h, `rider.profile street`, all per-kind defaults). Cells ship marked `TUNING-PIN`: blessed by the oracle's first green run, then frozen under 09 §4's iron rule (edits only via §3.3 re-bless).

Proposed table (defaults unchanged):

| Kind | Admissible | Fixture pin (TUNING-PIN) | Canonical diagnosis |
|---|---|---|---|
| `premature_contained` | {`violation`} | `violation` | — (fails `late_apex`, `out_in_out`) |
| `premature` | {`wide`, `runoff`} | `runoff` | — |
| `slow_steer` | {`wide`, `runoff`} | `runoff` | `roll_rate_limited` |
| `fifty_pence` | {`wide`, `runoff`} | `wide` | — (always fails `single_input`) |
| `chop` | {`wide`, `runoff`} | `runoff` (MERGED — verification's owner-framed cell wins; contested cell listed for owner sign-off) | `stand_up` |
| `overspeed` | {`wide`, `runoff`, `crash`} | `runoff` | `overspeed_entry` |

01 §4.3's "Emergent outcome (Tier 1R)" column is replaced by a pointer: "outcome classes are pinned in `03 §7.1` (the single normative table); the causal chains here are teaching prose." 09 §4's oracle sentence becomes: "…asserts the declared check actually fails, the outcome lies in the kind's **admissible set**, and on `F-ORACLE-90` equals the **fixture pin**."

**Placement:** 03 §7.1 (table restructure), 01 §4.3 (column → pointer), 09 §4 (one sentence). **Contract impact:** `schema mistakes` rows gain `admissible_outcomes` and `fixture_pin` fields (see 9.9). **Acceptance:** `ORACLE-PIN-TABLE` — the oracle's expected values are read from one machine-readable source that also feeds `schema mistakes`; a drifted duplicate is structurally impossible.

**Subsumption:** doctrine-catalogue (check ids the cells cite), verification (oracle fixture mechanics). This floor stands alone if both miss it.

---

### 9.3 — Occluder ref token: three unreconciled shapes

**Winner:** 03 §4's placement grammar, tightened; bare `c1` becomes defined sugar; 08 recipe (c) is corrected.

**Mechanism.** Pin the scene token grammar once in 03 §4:

```
occluder-token := <kind> <side> <anchor> <offset>x<span> [<key>=<val> …]
anchor  := <cornerId>                        # sugar for entry:<cornerId>
         | entry:<cornerId> | mid:<cornerId> | exit:<cornerId>
         | s:<metres>                     # absolute station
offset  := signed station metres from the anchor (start of the span)
span    := length in station metres, extending in +s
key=val := lateral/kind params only (margin=, depth=, mu=, width=…)
```

Two hard rules, each with a typed rejection: (a) **the anchor never carries an offset** — `entry:c1-25` is rejected `SCHEMA` with `schema_ref` to this grammar and message "station offset belongs in the `<offset>x<span>` token"; (b) `<offset>` is always a *station* offset — lateral placement is only ever `margin=`. Unknown corner id in an anchor → existing `BAD_ANCHOR`/`SCHEMA` path. So `hedge inside c1 -6x26 margin=1.2` (bookBlind) ≡ `hedge inside entry:c1 -6x26 margin=1.2`, spanning entry−6 m → entry+20 m. 08 recipe (c)'s `--occluder "hedge inside entry:c1-25 -1.0x30"` is corrected to `--occluder "hedge inside c1 -25x30 margin=1.0"`. 04 §7's example (`hedge inside c1 -6x26 margin=1.2`) already parses under the sugar — annotate it "(bare id = `entry:` sugar, 03 §4)".

**Placement:** 03 §4 placement-grammar paragraph (replaces the current `entry|exit|mid:<cornerId> ± offset_m` phrasing), 08 §6 recipe (c) (one token), 04 §7 (annotation). **Contract impact:** wire `Occluder.at` mirrors the same rule: `{ref: "entry|mid|exit:<id>"} | {at_s}` plus separate `offset_m` — no offset inside `ref` strings. **Acceptance:** `C-OCC-TOKEN` — parse goldens: bare-id ≡ entry-anchored; offset-in-anchor rejected typed; bookBlind's token resolves to the pinned absolute span; the vehicle spaced-offset form `vehicle oncoming exit:c1 +8` (scene-vocabulary §1.2 — bare signed offset, no span) parses to `at: {ref: "exit:c1", offset_m: 8}`, while the fused spelling (the `+8` glued into the anchor token) is rejected `SCHEMA`/`anchor_embedded_offset`.

**Subsumption:** scene-vocabulary (owns the full occluder/hazard wire shapes, P2). Floor: the three spellings above must reconcile to this grammar.

---

### 9.4 — `sight_m` (centreline-arc metres) vs `ssd_m` (rider-path metres), compared raw

**Which basis wins: rider-path metres — for every safety judgment.** The doctrinal question is "can I stop before reaching the point where the road disappears"; both the braking and the travel happen along the rider's own path. But `sight_m` keeps its centreline-station semantics and its name: it is the cross-line-comparable quantity (review §10 explicitly protects "the thing being seen does not vary") and it anchors the limit-point marker and sight rays. The fix is one recorded conversion, not a re-basing of the sight cast.

**Mechanism — the conversion and where it is computed.** The post-run recording analyzer (the same pass that writes per-sample sight, 03 §5.3) computes a new per-sample field by lookahead along the line's **own trajectory**:

```
sight_ride_m[i]:
  L = s[i] + sight_m[i]                                  # limit station (centreline m)
  if s[last] < L:   sight_ride_m[i] = pathlen(i, last)   # line ends first: clamped (conservative)
  else:             j = min { j > i : s[j] ≥ L }
                    alpha = (L − s[j−1]) / (s[j] − s[j−1])
                    sight_ride_m[i] = pathlen(i, j−1) + alpha·seg(j−1, j)
  seg(k) = hypot(x[k+1]−x[k], y[k+1]−y[k]);  pathlen = Σ seg
```

Exact (no local-curvature approximation like `1/(1−d·κ)`, which breaks when the lookahead crosses into a straight), cheap (one forward scan), and defined for failed lines (the clamp can only shorten sight — honest). On R12/lane 3.5 an inside line has ratio ≈ (12−1.55)/12 ≈ 0.87: the raw comparison overstated available distance by ~15 %, exactly the review's number.

**All judgments switch basis; display quantities stay honest:**
- 03 §5.2: "the per-point safety judgment is the comparison `sight_ride_m ≥ ssd_m`" (replaces `sight_m ≥ ssd_m`).
- 04 §6 V1 governor: `vis_margin · ssd(v) ≤ sight_ride_m` at every station (the fixpoint iteration re-runs the engine per candidate, so the trajectory needed for the lookahead exists at every iteration).
- 05: `derived.sight_margin_m = sight_ride_m − ssd_m`; `Verdict.sight.margin_min_m` = min over samples of the same; `stop_within_sight` check arithmetic cites `sight_ride_m`.
- 06 §4 controls strip: the overlaid channel becomes `sight_ride_m` vs `ssd_m` (same basis; the strip's caption discloses the basis).
- 07 §4 POV sight band: the "can see" tint still runs to `s + sight_m` (station basis — correct, it paints road surface); the red deficit band's far edge becomes the station the rider's path reaches after `ssd_m` of path (the inverse lookahead, exposed as `derived.ssd_station_m` in `stateAt`, not stored).
- `trend` stays defined on `sight_m` (it is a limit-point geometry cue and must stay comparable across lines).

**Corridor-vs-centreline overstatement:** pin the sight targets as the **ride-lane centre polyline** (line-independent, so cross-line comparability is untouched; on the single-lane presets this is a no-op clarification of "centreline"). Add a placard-style note in 03 §5.1: "sight is measured to lane-centre targets; visibility of the corridor's inner edge is not modelled — lane-centre fidelity is traded for cross-line comparability." That closes the overstatement for the rider's own lane at lane-width scale and honestly discloses the residual corridor-edge effect.

**Placement:** 03 §5.1 (targets + placard), §5.2 (judgment sentence), §5.3 (recording); 05 §2.1 (field row), §3.2 (`sight_ride_m` → `linear` rule), §4 (derived), §6.3 (verdict); 04 §6; 06 §4; 07 §4. **Contract impact:** Sample gains `sight_ride_m` (number, m) — CSV column **appended** after `limit_y` per the append-only rule; `derived.ssd_station_m` added to `InstantState`. **Acceptance:** `G-SIGHT-BASIS` golden — R12 inside-offset fixture: `sight_ride_m/sight_m` matches the geometric ratio within tolerance; `P-SIGHT-BASIS` property — on any straight with `d = 0`, `sight_ride_m = sight_m ± eps`; clamp case pinned on a runoff fixture.

**Subsumption:** pov-samples (Sample/derived fields), verification (golden). The basis law itself is owned here.

---

### 9.5 — Bookmarks "plan stations" (09) vs events-only (05/07); `sightFrom` cannot produce `trend`

**Winner:** events-only (05/07 agree; plan-action starts already surface as events: `brake_start`, `turn_in`, `position_start`…). And `trend` leaves `sightFrom`'s return — a pure function of `(road, eye, occluders)` (P-SIGHT-EYE's own words) has no previous sample.

**Mechanism.** (a) 09 `C-BOOKMARKS` drops "and plan stations": "the stepper's named jump targets are exactly the result's `events`; jumping lands the scrubber at the event's interpolated `t`." (b) 03 §5.1: `sightFrom(road, eye, occluders) → {sight_m, limit_point, s_limit}` — `trend` removed from the signature; the paragraph defining trend moves to 05 §4 (which 03 cites), where it is defined **once, windowed and deadbanded**: at sample `i`, compare `sight_m[i]` against `sight_m` at the sample nearest `s_i − SIGHT_TREND_WINDOW_M` (`5.0 m`, TUNING; clamped to the first sample early on): Δ > `+SIGHT_TREND_DEADBAND_M` (`2.0 m`, TUNING) → `opening`; Δ < −deadband → `closing`; else `steady`. (2 m of change per 5 m of travel is a slope threshold of 0.4 — the sane reading the review asked for.) The V1 governor keys off the **recorded per-sample trend**, not off `sightFrom`.

**Placement:** 09 §6 (`C-BOOKMARKS` wording), 03 §5.1 (signature + moved paragraph), 05 §4 (`sight_trend` definition — replaces "03 §5.1's definition, verbatim"). **Contract impact:** `sightFrom` return shape loses `trend`; `derived.sight_trend` unchanged in shape, now the defining site. **Acceptance:** P-SIGHT-EYE unchanged (now true as stated); `C-TREND-WINDOW` — synthetic sight profile golden pinning opening/closing/steady transitions at the window+deadband boundaries.

**Subsumption:** pov-samples (derived block), verification (test wording). Floor stands alone.

---

### 9.6 — Raw 200 Hz series has no contract home

**Winner:** 05 (one flat array). 02 §6 yields.

**Mechanism.** Amend 02 §6's retention sentence: "Both series are retained" → "**The raw 200 Hz series is integrator-internal working state, discarded after resampling.** The retained record is the arc-grid samples plus the exact event crossings (events carry exact `s`/`t` per 05 §5) and the final exact sample at termination. The time-base and sample contract are owned by `05`." Add one clarifying clause in 05 §3.1's optional time-uniform series note: "(derived from the arc grid at export; it is never the integrator's raw series)". `result_hash` therefore covers exactly the retained record — no hidden second series to hash or drift.

**Placement:** 02 §6 (one sentence swap), 05 §3.1 (one clause). **Contract impact:** none (05 already correct). **Acceptance:** `C-RAW-RETENTION` — schema-level: `Trajectory` has exactly one sample array; envelope round-trip contains no second series.

**Subsumption:** none.

---

### 9.7 — Exit-code tiers vs intended-fail lines; `scene` codes unspecified ⟨known overlap⟩

**Winner:** a single law replacing 08 §3.1's tier-3 row: **exit codes report deviation from declaration, not failure.**

**Mechanism.** Define *declared-failing* per line: (a) its `expect_fail` covers every failed check **and** its outcome matches what the declaration implies, or (b) it is a compiled `mistake` line whose outcome lies in its 03 §7.1 admissible set (the pin table *is* its declaration — no redundant `expect_fail` required). A *deviation* is: an undeclared check failure or undeclared non-clean outcome, **or a declared failure that did not occur** (both directions, matching 09 §4's "reconciled both ways"). Replacement tier table for 08 §3.1:

| Exit | Meaning |
|---|---|
| `0` | Ran as declared. `run` without `--gate` keeps the carried semantics: any completed physics outcome (a crash is a valid, interesting run). `run --gate`, `scene`, and `solve` exit 0 when every line matches its declaration — including intended-fail teaching lines. |
| `1` | A write failed (SVG/CSV/manifest); never masks tier 3. |
| `2` | Bad input: schema violation, unknown verb/flag, unparseable DSL/scene text. The sole validation tier (D8). `scene --check` and `check`: 0 valid / 2 invalid. |
| `3` | Deviation tier: `run --gate` or `scene` with any line deviating from its declaration; `solve` whose self-verified result is non-clean **and undeclared**; typed solver refusals (`NO_SOLUTION`); failed test/gate runs per 09. Artifacts are still written where possible — exit 3 never suppresses rendering ("reported as such, and still renders"). |
| `4` | Internal error (`INTERNAL`): an invariant breach past validation. Always a linelab bug. |

`scene` is declaration-gated by default (a teaching figure carries expectations by construction); `run` stays lenient without `--gate`. This makes "bake this figure containing an intended red line, fail my CI only on surprises" a one-command idiom.

**Placement:** 08 §3.1 (table replacement + the declared-failing definition), 08 verb table `scene` row (append "exit tiers per §3.1"), 04 §4.2 (cross-ref only). **Contract impact:** exit `4` added to the closed tier set (also the home for 9.11's deleted `dnf-spec-error`). **Acceptance:** `A-EXIT-DECLARED` — three-case script: intended-fail scene exits 0; `--gate` with an undeclared check failure exits 3; a declared failure that unexpectedly passes exits 3.

**Subsumption:** agent-interface (owns 08), verification (gate scripts). Floor: the declaration law and the five tiers.

---

### 9.8 — Spelling drift not one-to-one; `--mistake` sugar grammar undefined

**Winner:** the schema fields; flags realign to them, sugar is labelled sugar.

**Mechanism.** (a) Add `--vis <none|cautious>` as the mirroring flag; `--visibility-governed` is retained, documented as sugar for `--vis cautious`. (b) Soften 08 §4.1's claim to the review's wording: "**every schema field is reachable by exactly one documented flag**; sugar flags are marked `sugar` and listed beside their target." (c) `schema cli`'s content is pinned as the **cross-surface spelling table**: rows of `{field, scene_key, flag, sugar?}` — e.g. `{vis_hold_f, visHold=, --vis-hold}`, `{vis_margin, visMargin=, --vis-margin}`, `{vis, vis=, --vis, sugar: --visibility-governed}`, `{rider.start.speed_kmh, entry=, --entry, sugar: entry_kmh (solve-spec)}`. (d) Pin the `--mistake` sugar grammar in 08 §4.1 (CLI-only; scene text keeps full `key=val` + `scope=`, per 03 §7.2):

```
--mistake "<kind>[:<k>=<v>(,<k>=<v>)*][@<cornerId>(,<cornerId>)*|@all]"
```

mapping to `{kind, params, scope}` with `@all` → `"all_corners"`. MERGED (this bug pre-declared subsumption to agent-interface, which wins): the composed token `[lineId=]kind[:k=v,...][@scope]` is the ONLY grammar on all three surfaces — `--corners` is REMOVED and the scene `key=val … scope=` spelling is REJECTED `SCHEMA` with a typed rewrite hint printing the equivalent token; this sugar EBNF survives only as that token grammar minus the lineId prefix. Malformed token → `SCHEMA` with `schema_ref: "cli.mistake"`.

**Placement:** 08 §4.1 (flag list, claim, sugar grammar), 08 §5.1 (`schema cli` row shape), 03 §7.2 (one cross-ref sentence). **Contract impact:** `schema cli` body rows gain the four-column shape. **Acceptance:** `A-MISTAKE-SUGAR` — `--mistake "premature:early_by_m=6@c1,c2"` round-trips to `{kind:"premature", params:{early_by_m:6}, scope:["c1","c2"]}`; `A-FLAG-MAP` — every wire field appears exactly once as a non-sugar row in `schema cli`.

**Subsumption:** agent-interface. Floor: the table shape and the sugar EBNF.

---

### 9.9 — `schema` output structure unspecified ("exactly one JSON document" yet "wrapped")

**Winner:** the one-JSON-document discipline; "(wrapped)" is deleted and the document's shape is pinned.

**Mechanism.** 08 §5.1 gains the envelope:

```
MERGED: agent-interface owns 08 — its wrapper `{ok, value: {schema_version, engine,
rubric, checks_version, sections}}` and Section meta-shape are adopted verbatim
(`checks_version` added beside `rubric` at top level); the `SchemaDoc`/`SectionDoc`
names below are DROPPED. What this bug contributes and KEEPS is the row content:
Kind rows carry `{admissible_outcomes, fixture_pin}` (replacing `outcome_class`) so
`schema mistakes` prints the one normative pin table. Original draft shape, retired:

SchemaDoc = { ok: true, schema_version: "linelab/1", checks_version,
              section: "<name>" | "all",
              body: SectionDoc | { <name>: SectionDoc, … } }
SectionDoc = { doc,                    // one-paragraph teaching text (a string field, not wrapping)
               fields?: [ {name, type, units?, default?, enum?, required, doc} ],
               rows?:   [ <section-specific table rows> ] }
```

`schema` with no argument returns `section:"all"` with every section keyed in `body`. Section-specific `rows` carry the teaching tables as data, e.g. `schema mistakes` rows = 03 §7.1's pin table verbatim (`kind, params, admissible_outcomes, fixture_pin, book_figure, teaches` — see 9.2), `schema cli` rows = the spelling table (9.8). 08 §3.2's list item "the schema text (wrapped)" becomes "the `SchemaDoc`". The closed section list gains `hazards` (9.10).

**Placement:** 08 §5.1 (shape), 08 §3.2 (one phrase). **Contract impact:** `SchemaDoc`/`SectionDoc` are new pinned wire shapes; the G4 cold-start promise now names a parseable artifact. **Acceptance:** `A-SCHEMA-JSON` — every `schema <section>` output `JSON.parse`s and validates against `SchemaDoc`; the cold-start test consumes only `SchemaDoc` content.

**Subsumption:** agent-interface. Floor: the two shapes.

---

### 9.10 — 08 grab-bag: recipe count, `window:"all"`, import list, `config.mode`, `checks_version`, hazards

Six point resolutions:

1. **"five canonical agent recipes" → "six"** in 08's preamble (line 6). Trivial count rot.
2. **`ViewSpec.window`** in 06 §2.1 becomes `window?: {from: StationRef, to: StationRef} | "all"` — the escape hatch 06 §2.4 already promises becomes expressible as typed.
3. **Import list** (08 §7.1) completed: `import { run, solve, suggestTurnIn, chainedSolve, compileMistake, compare, sweep, validate, sightFrom, ssd, stateAt, project, renderViews, explain } from "linelab"` (`project` is 06 §2.5's pure projection entry point; `ssd` is 03 §5.2's). Add the reconciliation sentence: "the viewer may call `sightFrom` only for **hypothetical eyes** — positions not on any recorded line (what-if cursor drags, 07 §2.4); for any instant on a line, the recorded per-sample sight is authoritative and re-derivation is forbidden (05 §1)."
4. **`config.mode`: delete** from the wire schema (03 §6). `rider.profile` already selects the rider behaviour table (02 §3); nothing consumes `mode`, and D8 makes an accepted-but-unwired field the forbidden class. (User decision below; deletion is the recommendation.)
5. **`checks_version`: optional-with-default** — `checks_version?` (default: current, `2`) in 03 §6; the effective value is always echoed in `Verdict.checks_version`; zero-file completeness gets `--checks-version <n>`.
6. **`hazards`** added to 08 §5.1's closed schema-section list (03 §4 defines it as a distinct family; the list must match).

**Placement:** 08 preamble, 06 §2.1, 08 §7.1, 03 §6 (two field notes), 08 §4.1 + §5.1. **Contract impact:** ViewSpec union; wire schema loses `config.mode`, relaxes `checks_version`; import surface grows. **Acceptance:** `A-IMPORT-SURFACE` — every API name any design doc requires resolves from the package root; `schema config` shows `checks_version` optional with default and no `mode`.

**Subsumption:** agent-interface (all six), scene-vocabulary (items 4–5).

---

### 9.11 — Phase vocabulary boundaries; unreachable `dnf-spec-error` ⟨known overlap⟩

**Phase — winner:** 05's six values, given boundaries; 06's four bands realign to them.

**Mechanism.** MERGED — the phase HALF of this bug retires to pov-samples' five-token machine (`approach|turning|midcorner|exiting|done`, disjoint tokens, brake_start opens NO phase; this sheet pre-flagged itself as the floor if pov-samples missed the item — it did not). The fold below is retained only for its edge answers (no-brake lines skip naturally; chained re-entry; band realignment), re-keyed onto the five tokens. Original draft fold, superseded: 05 §4 pins an event→phase fold: phase is a state machine over the line's ordered events; each boundary event *starts* a phase — `brake_start → entry`, `turn_in → steering`, `steering_complete → mid`, `roll_on → exit`, `exit → done`; initial state `approach`. `derived.phase` at a sample = the phase started by the last boundary event with `t_event ≤ t` (ties: later event wins). Missing events skip naturally (a no-brake line goes `approach → steering` at turn-in); a line that terminates without an `exit` event keeps its last phase to the end (`done` is reached only through `exit`). On chained lines the fold continues globally: corner n's `exit` yields `done`, corner n+1's first boundary event re-enters `entry`/`steering` — deterministic, total, monotone per corner. 06 §4's band list is replaced by: "vertical bands are 05 §4's phases intersected with the window, labelled with the phase names" (the strip typically shows `entry/steering/mid/exit`, since the default window starts at `brake_start − 15 m`; the lead-in renders as an `approach` sliver).

**`dnf-spec-error` — winner:** D8. Deleted from the outcome enum (05 §6.1) and from 02 §7's parenthetical. Validation is the sole rejection point; invalid input surfacing at run time is by definition a linelab bug → typed `INTERNAL` error, exit `4` (9.7). For multi-line bakes, a line that never runs because its *solve* was refused is not an outcome either: the envelope's `lines` array becomes a union `LineResult | LineRefusal`, `LineRefusal = { line_id /* MERGED: not `name` — aligned with LineResult */, role, ok: false, error: {code, at, message, schema_ref?, detail?} }` (e.g. `NO_SOLUTION`) — the bake stays total, nothing is dropped silently, and the refusal participates in the 9.7 deviation law.

**Placement:** 05 §4 (mapping), 06 §4 (band sentence), 05 §6.1 (enum edit), 02 §7 (parenthetical deleted), 05 §7 envelope (`lines` union). **Contract impact:** outcome enum shrinks by one; envelope union member `LineRefusal` (new); exit 4 (shared with 9.7). **Acceptance:** `C-PHASE-TOTAL` property — over fuzzed scenarios, every sample's phase is defined, in the FIVE-token enum (`approach|turning|midcorner|exiting|done` — merged), and never regresses within a corner; `C-REFUSAL-ENVELOPE` — a scene with one unsatisfiable `vis=cautious` line bakes the others and carries one typed `LineRefusal`.

**Subsumption:** lifecycle (envelope/termination taxonomy), pov-samples (derived block), agent-interface (exit 4). Floor: the fold table and the enum deletion.

---

### 9.12 — Vacuous colour branch: the outcome/check relationship, defined once ⟨known overlap⟩

**Winner — SUPERSEDED BY THE MERGE:** the owner-level outcome decision adopted doctrine-catalogue's Option B (`outcome = fate`: `crash > runoff > wide > stopped > contained`, physics-only; the refinement this bug placed inside `outcome` lives instead in `quality`/the derived `clean` predicate; `violation` retired). This bug's fate/outcome split loses as vocabulary but its substance — 02 owns physics, checks never move the physical class, the vacuous 06 branch dies — survives verbatim in the merged law. `C-COLOUR-DERIVE` re-keys to (outcome × check results × severity) → quality. Original draft, superseded: one two-layer definition — 02 owns physical fate; 05 refines fate into outcome using the applicable check set; 06 maps outcome to colour with the vacuous branch deleted.

**Mechanism.**
- 02 §7 keeps `crash`, `runoff`, `wide` and replaces its `violation`/`clean` cells with one physical class: `contained` — stayed within the corridor to termination. Its outcome list becomes "fates: `crash > runoff > wide > contained`; the analyzers refine `contained` per 05 §6.1."
- 05 §6.1 defines: `outcome = fate` if fate ∈ {crash, runoff, wide}; else `violation` if **any applicable doctrine check fails**, else `clean`. The **applicable check set** is context-chosen (content owned by the doctrine catalogue): the single-corner set by default; the **chain-aware set** (containment + link-continuity + flow) for chained lines (04 §5); visibility checks only when occluders are present. "Clean" thus means *contained and passed the applicable bar* — a verdict-layer fact, never an integrator fact.
- 06 §5.1's formula loses its vacuous arm: `quality = "good" if outcome = clean | "contained" if outcome = violation | "failing" if outcome ∈ {wide, runoff, crash}`. No chain carve-out is needed: a correctly-ridden chained line's applicable set is the chain-aware set, it passes, outcome = `clean`, colour = green — 04 §5's promise now *derives* instead of being asserted. 04 §5's phrase "contained, not clean" is edited to "contained — and `clean` under its chain-aware bar (05 §6.1)".

**Placement:** 02 §7 (cells), 05 §6.1 (defining paragraph), 06 §5.1 (formula), 04 §5 (one phrase). **Contract impact:** none on wire spellings; the *meaning* of `clean`/`violation` is now singly defined. A `stopped` termination with the bike still in-corridor is fate `contained` (its reason lives in `terminated.reason` — vocabulary owned by the corrective-offroad cluster). **Acceptance:** `C-COLOUR-DERIVE` — table test over (fate × check results × context) incl. the chained-green fixture; asserts no input reaches the deleted branch.

**Subsumption:** doctrine-catalogue (owns applicable-set contents), corner-exit/lifecycle (fate boundaries). Floor: the three-layer definition.

---

### 9.13 — Wall presentation height 1.2 m vs 1.4 m eye

**Winner:** the binary is-opaque optical model (03 §4). The POV presentation constants lose and are re-derived from an invariant, not patched one by one.

**Mechanism.** 07 §4 (draw order, item 4) gains the invariant: "every occluder kind's presentation height **must exceed** `eye_height_m` (1.4 m) by at least `POV_OCCLUDE_CLEAR_M = 0.4 m` (TUNING). A POV in which the eye sees over any occluder would contradict 03's binary is-opaque model — that is a spec violation, not a tuning choice." Re-derived defaults (all TUNING): `hedge 1.8 m` (unchanged), `wall 2.0 m` (was 1.2 — the arithmetic bug), `bank 1.8 m` (was 1.5 — grazed the eye by 0.1 m), `vehicle 1.8 m` (was 1.5 — reads as a van/SUV; a 1.5 m sedan cannot honestly fully occlude a 1.4 m eye, and the plan-view model says it does). The existing claim "tall enough that every kind fully occludes the 1.4 m eye" becomes true by construction.

**Placement:** 07 §4 item 4 (constants + invariant sentence). **Contract impact:** none (presentation-only). **Acceptance:** `C-POV-OCCLUDE` — static config test: `min(kind heights) ≥ eye_height_m + POV_OCCLUDE_CLEAR_M`; plus one POV render golden with a `wall` fully breaking the road at the limit point.

**Subsumption:** pov-samples (POV rendering). Floor: the invariant.

---

### 9.14 — 00 §4 core-sample list vs 05's full table

**Winner:** both (the review adjudicated: declared minimum, not a conflict). One line of polish.

**Mechanism.** In 00 §4, append the three CSV-pinned fields to the commanded-controls parenthetical: `(cmd_lean, cmd_a, roll_rate, action_id, clipped, n_long, n_lat)`, and add: "(declared minimum — 05 §2.1's pinned table is normative and append-only; new fields land there first)". Note: after 9.4 lands, `sight_ride_m` joins 05's table; 00's sight parenthetical gains it too for the same no-surprise reason.

**Placement:** 00 §4 (one parenthetical + one sentence). **Contract impact:** none. **Acceptance:** none (doc-only; optionally fold into the existing doc-lint that checks 00's vocabulary against 05).

**Subsumption:** none.

---

## Decision drafts (editor assigns numbers)

1. **Outcome refines fate.** *Physical fate (02: crash/runoff/wide/contained) is the integrator's; `outcome` (05) refines `contained` into `violation`/`clean` via the context-chosen applicable check set; colour (06) maps outcome only.* Rationale: closes the vacuous colour branch, makes chained-line green derivable instead of asserted, and gives the mistake-pin tables a single vocabulary — one definition subsuming bugs 2, 11, 12's outcome halves.
2. **Exit codes report deviation from declaration.** *A line's declaration is its `expect_fail` set or, for compiled mistakes, the 03 §7.1 pin table; tier 3 fires only on deviation (either direction); tier 4 = INTERNAL.* Rationale: intended-fail teaching figures become scriptable and gateable without weakening CI — subsumes bugs 7 and 11's exit half.
3. **Safety compares in rider-path metres; comparability stays in centreline metres.** *`sight_m` (lane-centre-targeted, station basis) remains the comparable/rendered quantity; a recorded `sight_ride_m` (exact trajectory lookahead) is the sole basis for every sight-vs-stopping judgment.* Rationale: removes a ~15 % systematic error from the tool's central teaching number while preserving the cross-line comparability the review's keep-list protects.

## User decisions

(carried into structured output — config.mode deletion; overspeed crash admissibility; mistake-pin-as-declaration; vehicle presentation height.)
