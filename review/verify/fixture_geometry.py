#!/usr/bin/env python3
"""Executable checks for the geometric claims the design of record asserts.

linelab has no engine yet, so every geometric claim in design/ is currently
unverified prose. This script is the standalone reconstruction used to audit
D46 (2026-07-19). It re-derives, from the shipped DSL strings and the sight
model in 03 §5.1, the facts the docs assert — and fails where they disagree.

When the engine lands, these assertions must be reproduced by it. Until then
this file is the only thing standing between a stated number and a wrong one.

    python3 review/verify/fixture_geometry.py

Model reconstructed from:
  03 §2      carriageway centreline, physical edges at |d| = lane_width_m,
             corridor = own lane inset bike_margin_m, f = 0 inner / 1 outer
  03 §4      hedge band: margin_m outside the edge, extending depth_m further
  03 §5.1    sightFrom: eye = rider's actual position; targets = ride-lane
             centre polyline; first-blocked semantics
  03 §7a.4   the headroom ladder
  01 §A.2    blind(c) :<=> s_limit < s_end(c) at c's turn_in — PER LINE, since
             the eye is the rider's own position
"""

import math

G = 9.81
LANE_W = 3.5          # 03 §2  physical edge at |d| = lane_width_m
BIKE_MARGIN = 0.40    # 03 §2  corridor inset
BLIND_RESERVE_DEG = 35.0   # 01 §A.3 check 8
A_SSD = 7.0           # 03 §5.2 model "alert"
T_REACT = 1.0         # 02 §3 street profile
ESCAPE_DECEL = 3.0    # 03 §7a.2 escape_decel_mss
V_FLOOR = 2.0         # 02 §7 v_floor_ms — the escape terminates HERE, not at v=0
KAPPA_MAX = 1 / 7     # 03 §7a.2
DKAPPA_DS_MAX = 0.005     # 03 §7a.2, raised from 0.0025 (see check 3)
KAPPA_STEP_MAX = 1 / 7
LADDER = [-1.0, -0.6667, -0.3333, 0.0, 0.3333, 0.6667, 1.0]

_fail = []


def check(name, ok, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  — {detail}" if detail else ""))
    if not ok:
        _fail.append(name)


def note(name, detail):
    """A recorded fact or standing caveat — not an assertion, never a failure."""
    print(f"  [NOTE] {name}  — {detail}")


# ---------------------------------------------------------------- geometry

def road(entry_straight, radius, sweep_deg, hand="L"):
    """Return (point_at_station, s_end_of_corner).

    `hand="L"` puts the arc centre to the left (the shipped presets); `hand="R"`
    mirrors it. The hand matters because the rider's lane does NOT flip with it
    (03 §2 pins the ride lane at d in [0, lane_width_m] under right-hand traffic,
    and 03:219 pins that `hand=` does not move the traffic side). So on a
    left-hander the corner's `inside` band lies across the centreline from the
    rider, and on a right-hander it lies on the rider's own side — see check 8.
    """
    tm = math.radians(sweep_deg)
    sgn = 1.0 if hand == "L" else -1.0

    def pt(s):
        if s <= entry_straight:
            return (s, 0.0), 0.0
        th = (s - entry_straight) / radius
        if th <= tm:
            return (entry_straight + radius * math.sin(th),
                    sgn * (radius - radius * math.cos(th))), sgn * th
        ex = (entry_straight + radius * math.sin(tm),
              sgn * (radius - radius * math.cos(tm)))
        d = s - entry_straight - radius * tm
        return (ex[0] + d * math.cos(tm), ex[1] + d * sgn * math.sin(tm)), sgn * tm

    return pt, entry_straight + radius * tm


def offset(pt, s, d):
    """Lateral offset d (positive = right of travel) from the centreline at station s."""
    (x, y), psi = pt(s)
    return (x + d * math.sin(psi), y - d * math.cos(psi))


def _crosses(p, q, a, b):
    d1 = (q[0] - p[0], q[1] - p[1])
    d2 = (b[0] - a[0], b[1] - a[1])
    den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-12:
        return False
    t = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den
    u = ((a[0] - p[0]) * d1[1] - (a[1] - p[1]) * d1[0]) / den
    return 1e-9 < t < 1 - 1e-9 and 1e-9 < u < 1 - 1e-9


def hedge_polygon(pt, s_from, s_to, margin, depth, n=500, side=-1):
    """Band `inside` a corner, from margin outside the edge, depth further.

    `side=-1` is the inside of a LEFT-hander (d < 0, across the centreline from
    the rider); `side=+1` is the inside of a RIGHT-hander (d > 0, beyond the
    rider's OWN lane edge). The shipped presets are all left-handers, which is
    why the original reconstruction hard-coded d < 0.
    """
    inner, outer = side * (LANE_W + margin), side * (LANE_W + margin + depth)
    span = [s_from + (s_to - s_from) * i / n for i in range(n + 1)]
    return [offset(pt, s, inner) for s in span] + [offset(pt, s, outer) for s in reversed(span)]


def sight_from(pt, poly, s_eye, f, s_max, ds=0.25):
    """03 §5.1: eye at the rider's actual position, targets on the ride-lane centre,
    first-blocked. Returns s_limit, or None if nothing blocks within s_max."""
    eye = offset(pt, s_eye, BIKE_MARGIN + f * (LANE_W - 2 * BIKE_MARGIN))
    u = s_eye + 0.5
    while u < s_max:
        tgt = offset(pt, u, LANE_W / 2)   # own-lane centre
        if any(_crosses(eye, tgt, poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))):
            return u
        u += ds
    return None


def min_s_limit(entry, radius, sweep, margin=1.2, depth=2.5, pad=1.5):
    """Smallest s_limit over every plausible turn-in and lane position — the most
    favourable case for blindness. If this is not < s_end, the corner is not blind."""
    pt, s_end = road(entry, radius, sweep)
    poly = hedge_polygon(pt, entry - 6.0, s_end + pad, margin, depth)
    best = math.inf
    s_eye = entry - 4.0
    while s_eye < s_end:
        for j in range(6):
            sl = sight_from(pt, poly, s_eye, j / 5, s_end + 25)
            if sl is not None:
                best = min(best, sl)
        s_eye += 1.0
    return best, s_end


# ---------------------------------------------------------------- checks

def check_blind_fixture():
    print("\n1. blind(c) on the occluder-bearing fixture  [01 §A.2, 03 §3.1]")
    sl, se = min_s_limit(12.0, 12.0, 90.0)
    check("shipped bookBlind (L 12 ^90 + hedge) is NOT blind",
          not (sl < se), f"min s_limit {sl:.2f} m vs s_end {se:.2f} m")

    print("\n   Is blind(c) reachable by a 90-degree corner? Sweep radius, hedge margin AND")
    print("   turn-in station. blind(c) is a PER-LINE, SINGLE-turn-in predicate (the eye is")
    print("   the rider's own position, 03 §5.1) — so the scan must reach EVERY turn-in the")
    print("   solver might pick, floored low enough to catch an early one. (A prior draft of")
    print("   this check floored the scan at entry-4 and used an all-turn-in AND, and so")
    print("   MISSED the early-turn-in hold-wide blindness — the Q1/Q2 quantifier defect.)")
    print("     R     margin  s_end   min s_limit(any line)  | hold-wide blind @ doctrinal / @ any turn-in")
    any_cell = False
    wide_doc_any = wide_early_any = False
    worst_wide = None                                  # (deficit_m, R, margin, turn_in)
    TI_DOC = 12.0                                       # doctrinal turn-in = s0 = entry_straight
    for R in (9.0, 12.0, 12.7):
        for m in (0.0, 0.5, 1.2):
            pt, se = road(12.0, R, 90.0)
            poly = hedge_polygon(pt, 6.0, se + 1.5, m, 2.5)
            best = math.inf
            wide_doc = wide_early = False
            ti = 5.0                                    # entry-7, below the old entry-4 floor
            while ti < se:
                for j in range(6):
                    sl = sight_from(pt, poly, ti, j / 5, se + 25)
                    if sl is not None:
                        best = min(best, sl)
                w = sight_from(pt, poly, ti, 1.0, se + 25)   # the hold-wide (f=1.0) line
                if w is not None and w < se:
                    wide_early = True
                    if abs(ti - TI_DOC) < 0.01:
                        wide_doc = True
                    d = se - w
                    if worst_wide is None or d > worst_wide[0]:
                        worst_wide = (d, R, m, ti)
                ti += 1.0
            any_cell |= best < se
            wide_doc_any |= wide_doc
            wide_early_any |= wide_early
            print(f"     {R:4.1f}  {m:4.2f}   {se:6.2f}  {best:12.2f}         "
                  f"| {str(wide_doc):5s} / {wide_early}")
    check("no 90-degree corner is blind on the hold-wide line AT THE DOCTRINAL turn-in",
          not wide_doc_any,
          "the operationally-true claim: at rider.start.f=1.0 turning in at s0, the doctrinal "
          "line keeps sight of the exit — so the shipped solver's blind(c) verdict is not "
          "flipped and the 140-degree reshape stays justified")
    check("BUT the hold-wide line IS blind at an EARLY turn-in at the wide band edge (Q1/Q2)",
          wide_early_any,
          f"worst: blind by {worst_wide[0]:.2f} m at R={worst_wide[1]}, margin={worst_wide[2]}, "
          f"turn-in={worst_wide[3]:.0f} m (entry-{TI_DOC-worst_wide[3]:.0f}); a small-margin "
          f"effect (present at margin<=0.2), inside the design's own r in {{9,12,12.7}} sample")
    note("the claim 'no 90-degree corner is blind on the hold-wide line at ANY legal margin'",
         "(09 L757, 01 L538, 00-README L463) is OVERSTATED — a D46-class quantifier defect found "
         "2026-07-22. It holds only for turn-in >= entry-4 under an all-turn-in AND; blind(c) is "
         "SINGLE-turn-in, and sweeping turn-in down to entry-7 makes the hold-wide line blind on "
         "a 90-degree corner at the wide band edge. The 140-degree reshape is unaffected (blind "
         "at all turn-ins <= 20.5 m); the JUSTIFICATION prose is what is wrong.")
    note("a 90-degree corner CAN be blind on a cut-in line at margin <= 0.5",
         "marginally at margin=0.5 (0.10 m at R=12) but by 1.35 m at margin=0 "
         "(1.70 m at R=12.7) — see the table above. It makes blind(c) true for the "
         "bad line and false for the good one, which inverts hold_wide_for_sight's "
         "applicability. Do NOT claim 'no 90-degree corner at any margin'.")

    print("\n   Blindness is governed by SWEPT ANGLE, not radius and not hedge placement:")
    for sw in (90, 100, 110, 120, 130, 140, 150):
        pt, se = road(16.0, 12.0, float(sw))
        poly = hedge_polygon(pt, 10.0, 46.0, 1.2, 2.5)   # shipped -6x36
        tot = hit = 0
        ti = 12.0
        while ti <= 20.01:
            for j in range(6):
                sl = sight_from(pt, poly, ti, j / 5, se + 30)
                tot += 1
                hit += 1 if (sl is not None and sl < se) else 0
            ti += 1.0
        print(f"     R12 ^{sw:3d}  s_end={se:5.1f}  {100*hit/tot:3.0f}% of (turn-in x lane) cells blind")

    print("\n   LOCKED replacement: lane 3.5 | S 16 | L 12 ^140 | S 16, entry 34 km/h,")
    print("                       hedge inside c1 -6x36 margin=1.2 depth=2.5")
    pt, se = road(16.0, 12.0, 140.0)
    poly = hedge_polygon(pt, 10.0, 46.0, 1.2, 2.5)
    ok, cells, ti = True, 0, 12.0
    while ti <= 20.01:
        for j in range(11):                       # all lane positions, not just f in {0,1}
            sl = sight_from(pt, poly, ti, j / 10, se + 30)
            ok &= (sl is not None and sl < se)
            cells += 1
        ti += 0.5
    check("blind(c1) at EVERY (turn-in x lane) cell, entry-4..+4", ok,
          f"s_end {se:.2f} m, {cells} cells at 11 lane positions — a coarser "
          f"f in {{0,1}} check would miss an interior regression")
    check("stays in scope (sweep < SWEEP_UTURN_MIN = 170 at r <= 15)", 140.0 < 170.0)
    check("holds the proportion band", 0.55 <= 2 * LANE_W / 12.0 <= 0.9,
          f"road:radius = {2 * LANE_W / 12.0:.3f}")
    check("entry straight shorter than one arc length", 16.0 < se - 16.0,
          f"16.00 m approach vs {se - 16.0:.2f} m arc")
    check("hold-wide L_req at 34 km/h fits the approach", 13.8 <= 16.0,
          "L_req 13.8 m (position-channel.md:141) vs 16 m approach — "
          "the approach must lengthen from 12 m with the speed rise")

    print("\n   Occluder depth is inert; margin is not (01 §A.2, 03 §3.1):")
    base = None
    same = True
    for d in (1.0, 2.5, 5.0, 10.0, 25.0):
        pt, se = road(12.0, 12.0, 90.0)
        poly = hedge_polygon(pt, 6.0, se + 1.5, 0.0, d)
        sl = min((x for x in (sight_from(pt, poly, ti, j / 10, se + 25)
                              for ti in (8.0, 10.0, 12.0) for j in range(11))
                  if x is not None), default=math.inf)
        base = sl if base is None else base
        same &= abs(sl - base) < 1e-9
    check("hedge depth does not move s_limit at all", same,
          f"identical s_limit = {base:.2f} m across depth 1-25 m; only the "
          f"band's inner face matters, so `margin` is the decisive lateral knob")

    print("\n   The other occluder-bearing visibility fixture:")
    pt, se = road(8.0, 12.0, 75.0)          # fx-esses-blind: bookEsses leg R12 ^75
    poly = hedge_polygon(pt, 8.0, 20.0, 1.5, 4.0)
    any_blind, ti = False, 4.0
    while ti <= 12.01:
        for j in range(6):
            sl = sight_from(pt, poly, ti, j / 5, se + 30)
            any_blind |= (sl is not None and sl < se)
        ti += 1.0
    check("fx-esses-blind (bookEsses R12 ^75 + hedge) is NOT blind either", not any_blind,
          "75-degree legs are far below the ~115-degree threshold; bookEsses is committed "
          "ink (fig 8.6) and cannot be reshaped, so this fixture needs a different base")


def check_blind_lean_cap():
    print("\n2. BLIND_RESERVE_DEG discriminates between lines  [01 §A.3 check 8]")
    for v_kmh in (32.0, 34.0):
        v = v_kmh / 3.6
        inner = math.degrees(math.atan(v * v / (G * (12.0 + BIKE_MARGIN))))
        outer = math.degrees(math.atan(v * v / (G * (12.0 + LANE_W - BIKE_MARGIN))))
        disc = inner > BLIND_RESERVE_DEG > outer
        print(f"     {v_kmh:.0f} km/h on R12: cut-in lean {inner:.1f} deg, "
              f"hold-wide lean {outer:.1f} deg, cap {BLIND_RESERVE_DEG:.0f} deg")
        if v_kmh == 34.0:
            check("check 8 discriminates at the shipped 34 km/h", disc,
                  "cut-in fails, hold-wide passes — the intended teaching")
        else:
            note("at the retired 32 km/h the cap was unreachable in-corridor",
                 f"needs R = {v*v/(G*math.tan(math.radians(BLIND_RESERVE_DEG))):.3f} m "
                 f"inside a {12.0 + BIKE_MARGIN:.2f} m corridor floor; max lean "
                 f"{inner:.1f} deg. This is why the entry speed rose.")


def check_envelope_contains_corpus():
    print("\n3. P-CONT-ENVELOPE-CONTAINS-ACTUAL over the corpus  [09 §3.4a, 03 §7a.3]")
    # (name, [(kind, ...)]) — S straight, A arc(r,deg), T taper(r1,r2,deg)
    corpus = {
        "book90/bookBlind": [("S",), ("A", 12.0, 90.0), ("S",)],
        "bookDecreasing":   [("S",), ("T", 16.0, 9.0, 130.0), ("S",)],
        "bookEsses":        [("S",), ("A", 12.0, 75.0), ("S",), ("A", 12.0, 75.0), ("S",)],
        "bookHairpin":      [("S",), ("A", 10.0, 150.0), ("S",)],
        "bookDoubleApex":   [("S",), ("A", 12.0, 70.0), ("A", 24.0, 40.0), ("A", 12.0, 70.0), ("S",)],
        "C30":              [("S",), ("A", 30.0, 90.0), ("S",)],
    }
    worst_rate = 0.0
    for name, segs in corpus.items():
        ks, rate = [], 0.0
        for sg in segs:
            if sg[0] == "S":
                ks.append(0.0)
            elif sg[0] == "A":
                ks.append(1 / sg[1])
            else:
                r1, r2, deg = sg[1], sg[2], sg[3]
                ks += [1 / r1, 1 / r2]
                # r linear in swept angle (03:1080) => dk/ds = (r1-r2)/(theta*r^3)
                rate = max(rate, abs(r1 - r2) / (math.radians(deg) * min(r1, r2) ** 3))
        kmax = max(abs(k) for k in ks)
        step = max(abs(ks[i + 1] - ks[i]) for i in range(len(ks) - 1))
        worst_rate = max(worst_rate, rate)
        flag = "" if rate <= DKAPPA_DS_MAX else f"  <-- rate {rate:.6f} = {rate/DKAPPA_DS_MAX:.2f}x bound"
        print(f"     {name:18s} max|k|={kmax:.6f}  max step={step:.6f}  max dk/ds={rate:.6f}{flag}")
        check(f"{name}: |kappa| <= kappa_max_1pm", kmax <= KAPPA_MAX + 1e-6)
        check(f"{name}: boundary step <= kappa_step_max_1pm", step <= KAPPA_STEP_MAX + 1e-6)
    check("every preset satisfies |dkappa/ds| <= dkappa_ds_max_1pm2",
          worst_rate <= DKAPPA_DS_MAX,
          f"corpus max {worst_rate:.6f} (bookDecreasing) vs bound {DKAPPA_DS_MAX}")
    check("the rate bound was raised because 0.0025 excluded a committed preset",
          worst_rate > 0.0025,
          f"bookDecreasing runs {worst_rate:.6f} = {worst_rate/0.0025:.2f}x the "
          f"pre-amendment 0.0025, so P-CONT-ENVELOPE-CONTAINS-ACTUAL would have "
          f"failed on the decreasing-radius trap itself")


def ladder_old(kappa_L):
    """The pre-amendment form: branch keyed on sign(kappa_L). Kept as a regression
    witness — it is sign-broken and must not be reintroduced."""
    sg = math.copysign(1.0, kappa_L) if kappa_L != 0 else 0.0
    h_toward, h_away = KAPPA_MAX * sg - kappa_L, kappa_L + KAPPA_MAX * sg
    out = []
    for s in LADDER:
        k0 = kappa_L + s * (h_toward if s * sg > 0 else h_away)
        out.append((s, max(-KAPPA_MAX, min(KAPPA_MAX, k0))))
    return out


def ladder_new(kappa_L, hand):
    """03 §7a.4 as amended: evaluated in the hand frame, never on sign(kappa_L)."""
    kt_L = kappa_L * hand
    out = []
    for s in LADDER:
        h = (KAPPA_MAX - kt_L) if s > 0 else kt_L
        out.append((s, (kt_L + s * h) * hand))
    return out


def check_ladder():
    print("\n4. The headroom ladder is hand-symmetric and distinct  [03 §7a.4, 09 §3.4a]")
    cases = (("right-hander kappa_L=+1/12", +1 / 12, +1),
             ("left-hander  kappa_L=-1/12", -1 / 12, -1),
             ("straight     kappa_L= 0",     0.0,    -1))
    print("     pre-amendment form (sign(kappa_L) branch) — regression witness:")
    for label, kL, _ in cases:
        rows = ladder_old(kL)
        n = len({round(k, 10) for _, k in rows})
        over = [s for s, k in rows if abs(k - kL) > KAPPA_STEP_MAX + 1e-9]
        print(f"       {label}: {n}/7 distinct, {len(over)} rung(s) outside E(s_L)")

    print("     amended form (hand frame):")
    for label, kL, hand in cases:
        rows = ladder_new(kL, hand)
        k0s = [round(k, 10) for _, k in rows]
        over = [s for s, k in rows if abs(k * hand - kL * hand) > KAPPA_STEP_MAX + 1e-9]
        n = len(set(k0s))
        print(f"       {label}: {n}/7 distinct kappa0, "
              f"rungs outside the step bound: {over or 'none'}")
        check(f"{label}: every rung inside E(s_L)'s step bound", not over)
        if kL != 0:
            check(f"{label}: all 7 rungs distinct", n == len(LADDER))
        else:
            # on a straight the sigma<0 rungs share kappa0=0 and separate through
            # their ramp rates, so distinctness is asserted on road_dsl, not kappa0
            check("straight: the sigma>0 half still spreads", n >= 4,
                  "sigma<0 rungs differ by ramp rate, hence by spelled taper")
    a = [round(k, 10) for _, k in ladder_new(+1 / 12, +1)]
    b = [round(-k, 10) for _, k in ladder_new(-1 / 12, -1)]
    check("hand symmetry: right-hander rungs == -1 x left-hander rungs", a == b)


def check_escape_reach():
    print("\n5. The escape reaches unseen road at all  [04 §4d, 03 §7a.2]")
    v = 34.0 / 3.6
    print("     04 §4d phase 0 integrates 'the ridden plan unchanged' for t_react_s.")
    print("     That is determinate, but line-dependent: what the plan commands at the")
    print("     probe varies, and reach varies with it:")
    def reach_of(a0):
        d0 = v * T_REACT + 0.5 * a0 * T_REACT ** 2
        v1 = v + a0 * T_REACT
        # 04 §4d: terminates on v < v_floor_ms (02:767 = 2.0), NOT at v = 0
        return d0 + (v1 * v1 - V_FLOOR ** 2) / (2 * ESCAPE_DECEL)

    for lbl, a0 in (("coasting a=0", 0.0), ("braking -1.0", -1.0), ("throttle +1.0", 1.0)):
        print(f"       {lbl:16s} reach = {reach_of(a0):6.2f} m")
    reach, lo, hi = reach_of(0.0), reach_of(-1.0), reach_of(+1.0)
    note("escape reach is line-dependent, not a fixture constant",
         f"phase 0 integrates the ridden plan unchanged (04 §4d): "
         f"{lo:.1f}-{hi:.1f} m across plausible commands vs {reach:.1f} m coasting. "
         f"Never quote it without naming the line and probe.")
    print(f"\n     check-10 ssd at {A_SSD} m/s^2 = "
          f"{v * T_REACT + v * v / (2 * A_SSD):.2f} m; escape at "
          f"{ESCAPE_DECEL} m/s^2 = {reach:.2f} m")
    gap = reach - (v * T_REACT + v * v / (2 * A_SSD))
    print("     k_refuted > 0 requires the escape to reach past s_limit -- close to")
    print("     stop_within_sight at 3.0 rather than 7.0, but NOT the same function:")
    print("     ssd assumes constant-v reaction then constant decel, while phase 0")
    print("     integrates the ridden plan, and reach stops at v_floor not at 0.")
    print(f"     {{check 10 fails}} SUBSET OF {{reach@3.0 > sight}} SUPERSET OF {{k_refuted>0}}")
    print(f"     -> k_refuted CAN fire where check 10 passes, over a band of "
          f"{gap:.2f} m = {100*gap/(v*T_REACT + v*v/(2*A_SSD)):.0f}% of ssd@7.0.")


# ------------------------------------------------- vacuity sweep (2026-07-20)
# Checks 6-9 encode findings from the vacuity sweep of 09 §*. Following this
# file's existing convention, a DEFECT is stated as a PASSING check: the check
# asserts that the regime is unreachable, so a green run is the evidence that
# the gate under audit tests nothing. If one of these ever FAILS, the fixture
# has been repaired and the gate has become live — update the note, don't
# "fix" the harness.

A_SLEW_DEFAULT = 6.0   # 02 §5.2 table, 03 §6.1 — default slew_mss on brake/throttle
A_SU_ONSET = 2.5       # 02 §5.2
K_SU = 0.30            # 02 §5.2
PHI0_DEG = 5.0         # 02 §5.2
ROLL_RATE_STREET = math.radians(50.0)   # 02 §3 street profile, 50 deg/s


def a_long_avail(a_lat, mu=1.0):
    """02 §5.2 friction ellipse."""
    return mu * G * math.sqrt(max(0.0, 1 - (a_lat / (mu * G)) ** 2))


def a_noreturn(phi_rad, roll_rate=ROLL_RATE_STREET):
    """02 §5.3: A_SU_ONSET + roll_rate / (K_SU * tanh(|phi|/PHI0))."""
    t = math.tanh(abs(math.degrees(phi_rad)) / PHI0_DEG)
    if t <= 0:
        return math.inf
    return A_SU_ONSET + roll_rate / (K_SU * t)


def ssd(v, phi_rad, a_ssd=A_SSD, t_react=T_REACT, mu=1.0,
        roll_rate=ROLL_RATE_STREET):
    """03 §5.2 lean-aware stopping distance. Returns ssd_m."""
    react_m = v * t_react
    t_su = abs(phi_rad) / roll_rate
    a_lean = min(a_ssd, a_long_avail(G * math.tan(abs(phi_rad)), mu),
                 a_noreturn(phi_rad, roll_rate))
    if v <= a_lean * t_su:
        return react_m + v * v / (2 * a_lean)
    v_up = v - a_lean * t_su
    return react_m + (v * t_su - a_lean * t_su ** 2 / 2) + v_up ** 2 / (2 * a_ssd)


def check_analytic_slew():
    print("\n6. The analytic-acceptance layer's closed forms omit the command slew")
    print("   [09 §3.2a table, 02 §3 + §5.2, 03 §6.1]")
    print("     A-AN-* gates the FIRST BLESS: the bless script refuses (exit 3) unless")
    print("     the layer is green. Its closed forms are hand-computed ground truth, so")
    print("     an error here is not drift — it certifies a wrong engine as correct.")

    # 02 §3: a_cmd is a slew-limited approach to the action's target level, with
    # slew defaulting to A_SLEW_DEFAULT. Neither A-AN-BRAKE nor A-AN-RK4 authors
    # slew_mss, so both inherit 6.0 m/s^3 and neither closed form accounts for it.
    def ramp(v0, a_target, slew=A_SLEW_DEFAULT):
        """Distance and exit speed over the slew ramp to |a_target|."""
        t_r = abs(a_target) / slew
        sign = 1.0 if a_target > 0 else -1.0
        # a(t) = sign*slew*t ; v(t) = v0 + sign*slew*t^2/2 ; x = v0*t + sign*slew*t^3/6
        return (v0 * t_r + sign * slew * t_r ** 3 / 6,
                v0 + sign * slew * t_r ** 2 / 2, t_r)

    # --- A-AN-BRAKE: F-AN-BRAKE `lane 8 | S 400`, entry 100 km/h, brake decel=3.0 at s=50
    v0 = 100 / 3.6
    stated = 50 + (v0 ** 2 - V_FLOOR ** 2) / (2 * 3.0)
    dx, v1, t_r = ramp(v0, -3.0)
    actual = 50 + dx + (v1 ** 2 - V_FLOOR ** 2) / (2 * 3.0)
    err = actual - stated
    print(f"\n     A-AN-BRAKE  stated s* = {stated:.4f} m   (assumes a = -3.0 from t=0)")
    print(f"                 slewed s* = {actual:.4f} m   (ramp {t_r:.3f} s, {dx:.3f} m)")
    check("A-AN-BRAKE's stated stop station ignores the default slew",
          abs(err) > 0.01,
          f"error {err:+.4f} m against a +/-0.01 m tolerance = {abs(err)/0.01:.0f}x the band")
    # the v(t) limb is worse: it is wrong in FORM, not just offset
    t_mid = t_r / 2
    v_true = v0 - 3.0 * (A_SLEW_DEFAULT * t_mid ** 2) / (2 * 3.0)
    v_stated = v0 - 3.0 * t_mid
    rel = abs(v_true - v_stated) / v_true
    check("A-AN-BRAKE's `v(t) = v0 - 3.0*t` limb is wrong in form during the ramp",
          rel > 1e-9,
          f"at t={t_mid:.3f} s: {v_true:.4f} vs {v_stated:.4f} m/s, "
          f"rel {rel:.3e} = {rel/1e-9:.1e}x the 1e-9 tolerance — v is quadratic in t, not linear")

    # --- A-AN-RK4: F-AN-ACCEL `lane 8 | S 400`, entry 36 km/h, throttle accel=2.0 at s=0
    print(f"\n     A-AN-RK4    claims v(t) = 10 + 2t exactly (RK4 exact on polynomial dynamics)")
    t_r2 = 2.0 / A_SLEW_DEFAULT
    worst_rel = 0.0
    for i in range(1, 101):
        t = t_r2 * i / 100
        v_true = 10.0 + A_SLEW_DEFAULT * t ** 2 / 2
        worst_rel = max(worst_rel, abs(v_true - (10.0 + 2.0 * t)) / v_true)
    check("A-AN-RK4's three closed forms ignore the same default slew",
          worst_rel > 1e-9,
          f"worst rel error over the {t_r2:.3f} s ramp = {worst_rel:.3e} = "
          f"{worst_rel/1e-9:.1e}x the 1e-9 tolerance")
    note("this is not vacuity but its mirror — an UNSATISFIABLE gate",
         "A-AN-BRAKE and A-AN-RK4 are exactly the two A-AN-* entries with a nonzero "
         "longitudinal command, i.e. the only two the slew can touch. As written "
         "neither can pass, so at implementation each will be reconciled by loosening "
         "its tolerance — and a tolerance wide enough to absorb 3.1e-2 relative is wide "
         "enough to absorb the stage-weight wiring bug the gate exists to catch. "
         "Repair: author `slew_mss: 100` (SLEW_MAX) on both plans, or restate the "
         "closed forms with the ramp term.")
    # option (a) `slew_mss: 100` is INSUFFICIENT: SLEW_MAX = 100 (02 §5.2), and the s*
    # error decays ~ 1.5*v0/slew, so at slew=100 it is still ~0.42 m = 42x the +/-0.01 m
    # band (and the v(t) limb ~1e-3, 1e6x the 1e-9 band). Only option (b) — restate the
    # closed forms with the ramp term — yields a satisfiable gate.
    err_at_max = abs((v0 * (3.0 / 100) - 100 * (3.0 / 100) ** 3 / 6)
                     + ((v0 - 4.5 / 100) ** 2 - v0 ** 2) / (2 * 3.0))
    check("slew_mss: 100 (option a) is INSUFFICIENT — s* error still 42x tolerance at SLEW_MAX",
          err_at_max > 0.01,
          f"at slew=SLEW_MAX=100 the s* error is {err_at_max:.3f} m = {err_at_max/0.01:.0f}x the "
          f"+/-0.01 band; APPLIED repair is option (b), restate with the ramp term (09 §3.2a)")


def check_ssd_governor():
    print("\n7. Does the V1 speed governor bind on the D46-reshaped bookBlind?")
    print("   [09 §3.5 A-SSD-GOVERNOR, 04 §6, 03 §5.2]")
    print("     D46 reshaped bookBlind to `S 16 | L 12 ^140 | S 16` @ 34 km/h to make")
    print("     blind(c1) true. A-SSD-GOVERNOR is a different predicate: V1 binds iff")
    print("     vis_margin * ssd(v, phi) > sight_ride_m at some station.")
    entry, r, sweep = 16.0, 12.0, 140.0
    v = 34 / 3.6
    pt, s_end = road(entry, r, sweep)
    poly = hedge_polygon(pt, entry - 6.0, entry + 36.0, 1.2, 2.5)

    rows = []
    for lbl, f in (("hold-wide f=1.0", 1.0), ("cut-in   f=0.0", 0.0)):
        # lean the doctrinal line actually carries through the corner
        d = BIKE_MARGIN + f * (LANE_W - 2 * BIKE_MARGIN)
        r_line = r + d          # left-hander: outer line runs a larger radius
        phi = math.atan(v * v / (G * r_line))
        worst = math.inf
        s_eye = entry - 4.0
        while s_eye < s_end:
            sl = sight_from(pt, poly, s_eye, f, s_end + 25)
            if sl is not None:
                worst = min(worst, sl - s_eye)
            s_eye += 0.5
        rows.append((lbl, phi, worst, ssd(v, phi)))
        print(f"       {lbl}: r_line {r_line:5.2f} m  phi {math.degrees(phi):5.2f} deg  "
              f"min sight {worst:6.2f} m  ssd {ssd(v, phi):6.2f} m")

    worst_sight = min(x[2] for x in rows)
    worst_ssd = max(x[3] for x in rows)
    check("the V1 governor cannot bind on the reshaped bookBlind at vis_margin = 1.0",
          1.0 * worst_ssd <= worst_sight,
          f"max ssd {worst_ssd:.2f} m vs min sight {worst_sight:.2f} m — "
          f"{100*(worst_sight-worst_ssd)/worst_ssd:.0f}% headroom")
    binding = worst_sight / worst_ssd
    print(f"     the governor first binds at vis_margin >= {binding:.3f}")
    note("A-SSD-GOVERNOR is still vacuous after the D46 reshape",
         f"blind(c1) and 'the governor binds' are different predicates and D46 only "
         f"repaired the first. The gate asserts governed entry speed <= unfettered; "
         f"with the governor inert the two solves are IDENTICAL, so <= holds by equality. "
         f"09's own OPEN obligation (b) — strengthen <= to < — must NOT be applied alone: "
         f"on this fixture a strict < converts a silent pass into a silent FAIL. "
         f"Pin vis_margin >= {math.ceil(binding*10)/10:.1f} in the scenario first.")


def check_right_hand_inside_band():
    print("\n8. On a right-hander the `inside` occluder sits on the rider's OWN side")
    print("   [09 §3.5 fx-esses-blind, 03 §2, 03 §4, 03:219]")
    print("     Every shipped preset is a left-hander, so the original reconstruction")
    print("     hard-coded `inside` as d < 0. bookEsses alternates hands, and 03:219")
    print("     pins that `hand=` does not move the traffic side — so on its RIGHT")
    print("     corners the band lands between the rider and the corner exit.")
    # fx-esses-blind c1: `S 8 | R 12 ^75`, hedge inside c1 margin=1.5 depth=4
    entry, r, sweep, margin, depth = 8.0, 12.0, 75.0, 1.5, 4.0
    res = {}
    for hand, side in (("L", -1), ("R", +1)):
        pt, s_end = road(entry, r, sweep, hand=hand)
        poly = hedge_polygon(pt, entry - 6.0, s_end + 1.5, margin, depth, side=side)
        blind_cells = total = 0
        best = math.inf
        s_eye = entry - 4.0
        while s_eye < s_end:
            for j in range(11):
                total += 1
                sl = sight_from(pt, poly, s_eye, j / 10, s_end + 25)
                if sl is not None:
                    best = min(best, sl)
                    if sl < s_end:
                        blind_cells += 1
            s_eye += 1.0
        res[hand] = (blind_cells, total, best, s_end)
        print(f"       hand={hand}  inside band at d {'<' if side < 0 else '>'} 0:  "
              f"{blind_cells}/{total} blind cells   min s_limit "
              f"{best if best < math.inf else float('nan'):6.2f}  vs s_end {s_end:.3f}")
    check("a 75-degree LEFT-hander with this hedge is not blind (the doc's claim)",
          res["L"][0] == 0,
          f"{res['L'][0]}/{res['L'][1]} cells — 75 deg is far below the ~115 deg threshold of check 1")
    check("the same corner mirrored to a RIGHT-hander IS blind on some lines",
          res["R"][0] > 0,
          f"{res['R'][0]}/{res['R'][1]} cells, min s_limit {res['R'][2]:.2f} m "
          f"vs s_end {res['R'][3]:.3f} m — the band no longer sits across the centreline")
    note("fx-esses-blind's recorded diagnosis is wrong in KIND, not just in degree",
         "09 §3.5's OPEN block records 'blind(c) false on all four corners, zero cells' "
         "and prescribes minting a new >=130-degree chained fixture. But bookEsses "
         "alternates hands, so c1 and c3 are right-handers whose inside band lies beyond "
         "the rider's own lane edge — blindness there is an INVERSION (blind on the "
         "cut-in line, sighted on the doctrinal hold-wide line), which is the same "
         "applicability inversion D46 exemplar #1 was about. The prescribed repair does "
         "not address it. This harness reproduces the mechanism on c1 standalone; the "
         "full four-corner chain is still prose-only.")


def check_tightening_is_identity():
    print("\n9. P-CONT-TIGHTENING-ADMISSIBLE is an identity, not a measurement")
    print("   [09 §3.4a, 03 §7a.4]  (DEFERRED surface — D45, gated on S-CONT-SEPARATION-v2)")
    print("     Asserts: at every probe, >=1 admissible member has |kappa_m| > |kappa_L|")
    print("     over its whole curved tail. The sigma=+1 rung is pinned at kappa_max.")
    corpus = [("book90 / bookBlind", 12.0), ("bookEsses", 12.0),
              ("bookHairpin", 10.0), ("bookDoubleApex", 12.0),
              ("bookDecreasing (tightest)", 9.0), ("C30", 30.0)]
    worst = 0.0
    for lbl, r in corpus:
        k_l = 1.0 / r
        print(f"       {lbl:26s} |kappa_L| = {k_l:.6f}   margin to kappa_max = "
              f"{KAPPA_MAX - k_l:+.6f}")
        worst = max(worst, k_l)
    check("the sigma=+1 rung strictly exceeds |kappa_L| on every corner in the corpus",
          worst < KAPPA_MAX,
          f"tightest corpus corner |kappa_L| = {worst:.6f} (r = {1/worst:.1f} m) vs "
          f"kappa_max = {KAPPA_MAX:.6f} — margin {KAPPA_MAX - worst:+.6f}, never zero")
    r_needed = 1 / (0.9 * KAPPA_MAX)
    note("the existential is witnessed by construction, so the property cannot fail",
         f"03 §7a.4 pins k~0(sigma=+1) = k~_L + 1*(kappa_max - k~_L) = kappa_max exactly, "
         f"and under total occlusion `admissible` is universally true — so BOTH limbs hold "
         f"by construction for every corner with |kappa_L| < kappa_max. It would keep "
         f"passing through a filter that wrongly discarded every OTHER member. It "
         f"discriminates only at |kappa_L| >= 0.9*kappa_max, i.e. r <= {r_needed:.1f} m, "
         f"which no preset reaches (tightest is r = {1/worst:.0f} m). Repair: re-home onto "
         f"a dedicated tight-radius fixture, or strengthen to 'the tightening member "
         f"SURVIVES the filter' so the filter is actually exercised.")


# ------------------------------------------- the four uncovered quantities
# Checks 10-13 (added 2026-07-22) make executable the four quantities the
# docstring long warned were prose-only. Three (C30-DR taper, R_res, L_req)
# confirm the design's stated numbers are CORRECT — each check FAILS if a future
# implementation drifts from the number. The fourth (fx-hedge-gap) states a
# vacuity per this file's convention: a PASSING check is the evidence that the
# regime is unreached (the fixture is unauthored).

def check_c30_dr_taper():
    print("\n10. C30-DR taper rate vs DKAPPA_DS_MAX  [02 §8.2, 03 §7a.2/§7a.3]")

    def dk_ds_tight_end(r1, r2, deg):
        # 03 §7a.3/§7a.4: r linear in swept angle -> dkappa/ds = (r1-r2)/(theta*r^3),
        # maximised at the tight end r=min(r1,r2). Same expression as check 3.
        return abs(r1 - r2) / (math.radians(deg) * min(r1, r2) ** 3)

    BOUND = DKAPPA_DS_MAX          # 0.005 1/m^2
    R1, R2 = 40.0, 25.0            # 02 §8.2 "R40->R25 clothoid"
    cal = dk_ds_tight_end(16.0, 9.0, 130.0)   # bookDecreasing calibration
    check("formula reproduces bookDecreasing's design number 0.004232",
          abs(cal - 0.004232) < 5e-7, f"derived {cal:.6f}")
    r60 = dk_ds_tight_end(R1, R2, 60.0)
    check("C30-DR at the 60deg floor <= 0.001 (design 03 §7a.3 stated cap)",
          r60 <= 0.001, f"{r60:.6f}")
    check("C30-DR at the 60deg floor is nowhere near the 0.005 bound",
          r60 <= BOUND, f"{r60:.6f} = {r60/BOUND:.3f}x bound, {BOUND/r60:.1f}x margin")
    for deg in (70.0, 90.0):
        r = dk_ds_tight_end(R1, R2, deg)
        check(f"C30-DR at ^{deg:.0f} (a real C30-family sweep) is under bound",
              r <= BOUND, f"dk/ds={r:.6f} = {BOUND/r:.1f}x margin")
    breach_deg = math.degrees((R1 - R2) / (BOUND * R2 ** 3))
    check("breach of DKAPPA_DS_MAX requires a sweep below ~11deg (not a corner)",
          10.0 < breach_deg < 12.0,
          f"breach at sweep {breach_deg:.2f}deg; C30 family sweeps are 70-90deg")
    note("no §09 gate asserts on C30-DR's TAPER RATE",
         "T-BLESSED-DOC-SYNC (09 §3.2) pins only the scalars 02 §8 enumerates; dk/ds is not "
         "among them. C30-DR has no DSL string, so P-CONT-ENVELOPE-CONTAINS-ACTUAL never reaches "
         f"it either. Uncovered AND unbinding: it sits {BOUND/r60:.1f}x under the bound.")


def check_r_res():
    print("\n11. R_res at the BLIND_RESERVE_DEG = 35 cap  [01 §A.3 check 8; uncovered]")
    CAP = math.radians(BLIND_RESERVE_DEG)
    SKILL, MU = 0.85, 1.0

    def R_res_cap(v):  return v * v / (G * math.tan(CAP))
    def R_res_full(v): return v * v / (G * math.tan(math.atan(SKILL * MU)))
    def lean_deg(v, R): return math.degrees(math.atan(v * v / (G * R)))

    corridor_floor = 12.0 + BIKE_MARGIN          # cut-in radius on the R12 blind corner
    hold_wide_R = 12.0 + LANE_W - BIKE_MARGIN
    check("corridor floor is road R + BIKE_MARGIN", abs(corridor_floor - 12.40) < 1e-9,
          f"cut-in radius = {corridor_floor:.2f} m; hold-wide radius = {hold_wide_R:.2f} m")
    v32 = 32.0 / 3.6
    r32 = R_res_cap(v32)
    check("R_res_cap(32 km/h) = 11.503 m (matches fg check 2 note)",
          abs(r32 - 11.503) < 5e-4, f"derived {r32:.4f} m")
    check("at 32 km/h the cap sits INSIDE the corridor floor -> unreachable in-corridor",
          r32 < corridor_floor,
          f"{r32:.3f} m needed vs {corridor_floor:.2f} m floor; tightest legal lean only "
          f"{lean_deg(v32, corridor_floor):.2f} deg < {BLIND_RESERVE_DEG:.0f} cap — why entry rose to 34")
    v34 = 34.0 / 3.6
    inner, outer = lean_deg(v34, corridor_floor), lean_deg(v34, hold_wide_R)
    check("at 34 km/h R_res_cap = 12.987 m OUTSIDE the floor -> reachable in-corridor",
          R_res_cap(v34) > corridor_floor, f"derived {R_res_cap(v34):.4f} m")
    check("check 8 discriminates at 34 km/h: cut-in > cap > hold-wide",
          inner > BLIND_RESERVE_DEG > outer,
          f"cut-in {inner:.2f} deg (reserved), hold-wide {outer:.2f} deg (passes), cap {BLIND_RESERVE_DEG:.0f}")
    v_be = math.sqrt(G * corridor_floor * math.tan(CAP))
    check("cap reachable in-corridor iff entry >= 33.225 km/h (R_res_cap == floor)",
          abs(v_be * 3.6 - 33.225) < 0.01, f"break-even {v_be*3.6:.3f} km/h")
    check("FRAGILE: at 33 km/h the cut-in lean is already below the cap (gate -> na)",
          lean_deg(33.0 / 3.6, corridor_floor) < BLIND_RESERVE_DEG,
          f"cut-in lean {lean_deg(33.0/3.6, corridor_floor):.3f} deg < cap; shipped 34 clears "
          f"break-even by only {34.0 - v_be*3.6:.2f} km/h — a 1 km/h downward re-tune re-vacates check 8")
    check("full-reserve R_res (04 §4c, atan 0.85) is NOT the 35-cap radius",
          abs(R_res_full(v32) - 9.4756) < 5e-4,
          f"full-reserve R_res(32) = {R_res_full(v32):.4f} m vs 35-cap {r32:.4f} m — not interchangeable")


def check_l_req():
    print("\n12. L_req — required approach length for a `position` move  [03 §6.1]")
    A_LAT_POS_MAX, K_REACH, ROLL_RATE_DPS = 0.8, 1.2, 50.0   # 02 §5.2, §3
    W_CORR = LANE_W - 2 * BIKE_MARGIN                          # 2.70 m
    PHI_AUTH = math.atan(A_LAT_POS_MAX / G)
    T_ROLL = PHI_AUTH / math.radians(ROLL_RATE_DPS)
    kmh = lambda k: k / 3.6

    def L_req(dd, v): return 2 * v * (math.sqrt(K_REACH * dd / A_LAT_POS_MAX) + T_ROLL)
    def dd_max(T):    return A_LAT_POS_MAX * max(0.0, T / 2 - T_ROLL) ** 2
    def dd_of(df):    return abs(df) * W_CORR

    check("phi_auth = atan(a_lat_pos_max/G) = 4.662 deg",
          abs(math.degrees(PHI_AUTH) - 4.662) < 5e-4, f"{math.degrees(PHI_AUTH):.4f} deg")
    check("t_roll (street 50 deg/s) = 0.09324 s", abs(T_ROLL - 0.09324) < 5e-5, f"{T_ROLL:.5f} s")
    for k, want in [(34, 13.8), (32, 13.0), (28, 11.3)]:
        check(f"L_req(0.27 m, {k} km/h) = {want} m (design 03:301 / position-channel:142)",
              abs(L_req(dd_of(0.1), kmh(k)) - want) <= 0.05, f"derived {L_req(dd_of(0.1), kmh(k)):.3f} m")
    check("L_req(1.08 m, 34 km/h) = 25.8 m (design 03:767)",
          abs(L_req(dd_of(0.4), kmh(34)) - 25.8) <= 0.05, f"derived {L_req(dd_of(0.4), kmh(34)):.3f} m")
    # THE GATE: T-POS-INEFFECTUAL / FX-POS-SHORTWIN (09:1985), start.f 0.2 -> 0.9, 34 km/h
    dd_sw, v_sw = dd_of(0.7), kmh(34)
    req = L_req(dd_sw, v_sw)
    check("T-POS-INEFFECTUAL: required_over_m = L_req(1.89, 9.44) >= 33.5 (09:1985)",
          req >= 33.5, f"derived {req:.4f} m — the rejection payload")
    mut_no_troll = 2 * v_sw * math.sqrt(K_REACH * dd_sw / A_LAT_POS_MAX)
    mut_k1 = 2 * v_sw * (math.sqrt(1.0 * dd_sw / A_LAT_POS_MAX) + T_ROLL)
    check("the >=33.5 bar kills all 3 L_req mutants (drop-t_roll / K=1.0 / no-factor-2)",
          mut_no_troll < 33.5 and mut_k1 < 33.5 and req / 2 < 33.5,
          f"mutants = {mut_no_troll:.2f} / {mut_k1:.2f} / {req/2:.2f} m — the gate is NON-vacuous")
    L34 = L_req(dd_of(0.1), kmh(34))
    check("reshaped bookBlind: L_req(0.27, 34) fits the 16 m approach (fg check 1, now DERIVED)",
          L34 <= 16.0, f"{L34:.3f} m <= 16 m — derived, not the hard-coded 13.8 literal")
    check("...and would NOT fit book90's original 12 m approach — why it had to lengthen",
          L34 > 12.0, f"{L34:.3f} m > 12 m at 34 km/h")
    note("L_req(0.27, v) sweep [26..40 km/h]",
         "  ".join(f"{k}:{L_req(dd_of(0.1), kmh(k)):.1f}" for k in range(26, 42, 2))
         + "  (crosses 16 m between 38 and 40 km/h)")


def check_fx_hedge_gap():
    print("\n13. fx-hedge-gap — does the re-emergence regime exist?  [09 §3.4a, 03 §7a.5]")
    print("    DEFERRED surface (D45). The continuation filter (03 §7a.5) is VACUOUS under")
    print("    total occlusion; fx-hedge-gap exists to give it a re-emergence to act on.")
    ENTRY, R, SW = 16.0, 12.0, 140.0                 # bookBlind, D46-LOCKED
    HS0, HS1, HM, HD = 10.0, 46.0, 1.2, 2.5          # hedge inside c1 -6x36
    EPS_LAT = 1.0
    pt, s_end = road(ENTRY, R, SW)
    s_tot = ENTRY + R * math.radians(SW) + 16.0      # exit-straight end
    LW, BM = LANE_W, BIKE_MARGIN

    def band(s0, s1, margin):
        return hedge_polygon(pt, s0, s1, margin, HD, n=max(8, int(2 * (s1 - s0))))

    def blocked(polys, eye, tgt):
        return any(_crosses(eye, tgt, p[i], p[(i + 1) % len(p)])
                   for p in polys for i in range(len(p)))

    def raw_cast(polys, s_eye, f, ds=0.5):
        eye = offset(pt, s_eye, BM + f * (LW - 2 * BM))
        u, seq = s_eye + 0.5, []
        while u < s_tot:
            seq.append((u, blocked(polys, eye, offset(pt, u, LW / 2))))
            u += ds
        s_L = next((x for x, b in seq if b), None)
        if s_L is None:
            return None, []
        return s_L, [x for x, b in seq if x > s_L and not b]

    PROBES, FS = (12.0, 14.0, 16.0, 18.0, 20.0), (0.0, 0.5, 1.0)
    # (1) baseline: total occlusion -> filter vacuous
    full = [band(HS0, HS1, HM)]
    reem_total = sum(len(raw_cast(full, se, f)[1]) for se in PROBES for f in FS)
    check("shipped bookBlind is total occlusion: NO road re-emerges past the occluder",
          reem_total == 0,
          f"{reem_total} re-emergent stations over {len(PROBES)*len(FS)} cells -> the filter's "
          f"clauses 2/3 are silent, so it discards nothing: VACUOUS on the only authored fixture")
    # (2) shortened-span family never threads (design's 54-cell claim)
    reem = 0
    for s_to in [float(x) for x in range(14, 47, 2)]:
        if s_to <= HS0 + 3:
            continue
        for margin in (0.0, 0.5, 1.2, 2.0, 3.0):
            polys = [band(HS0, s_to, margin)]
            reem += sum(1 for se in PROBES for f in FS
                        if (lambda sl_r: sl_r[0] is not None and sl_r[1])(raw_cast(polys, se, f)))
    check("shortening a SINGLE band's span never opens a gap (design pinned 0 of 54 cells)",
          reem == 0, f"{reem} threading cells — a shorter band only moves first-blocked later")
    # (3) a two-segment ENTRANCE gap DOES thread; a mid-corner gap is inert
    def gap_polys(gc, gw):
        g0, g1 = gc - gw / 2, gc + gw / 2
        return [band(HS0, g0, HM), band(g1, HS1, HM)], g0, g1
    entrance_hit, midcorner_reem = None, 0
    for gc in [float(x) for x in range(16, 42, 2)]:
        for gw in (4.0, 6.0, 8.0):
            polys, g0, g1 = gap_polys(gc, gw)
            if g0 <= HS0 + 1 or g1 >= HS1 - 1:
                continue
            s_L, r = raw_cast(polys, 16.0, 0.0)
            if s_L is not None and r and s_L < s_end and gc <= 20.0 and entrance_hit is None:
                entrance_hit = (g0, g1, s_L, r[0], r[-1], len(r))
            if gc >= 24.0 and s_L is not None:
                midcorner_reem += len(r)
    check("an ENTRANCE gap threads: road re-emerges while blind(c1) still holds",
          entrance_hit is not None,
          None if entrance_hit is None else
          f"gap[{entrance_hit[0]:.1f},{entrance_hit[1]:.1f}]: s_L={entrance_hit[2]:.2f} < s_end "
          f"{s_end:.2f}, road visible again {entrance_hit[3]:.2f}..{entrance_hit[4]:.2f} m "
          f"({entrance_hit[5]} stations)")
    check("a MID-CORNER gap (center >= 24 m) is geometrically inert (never threads)",
          midcorner_reem == 0,
          f"{midcorner_reem} re-emergent stations — the 140deg wrap holds far targets behind the band")
    note("APPLIED 2026-07-23: fx-hedge-gap's two-segment entrance geometry is now authored",
         "09 §3.4a fx-hedge-gap now carries `hedge inside c1 -6x4` + `+2x28 margin=1.2 depth=2.5` "
         "on bookBlind — this check's proven gap[14,18]. P-CONT-FILTER-TWO-SIDED, P-CONT-CONSISTENT's "
         "non-vacuity guard and P-CONT-MONOTONE-SIGHT are hosted on a fixture that exists; the "
         "four gates are unblocked. This check remains the standing proof the entrance gap threads.")


# ------------------------------------------------ applied repairs (2026-07-23)
# Check 14 confirms the vacuity-sweep repairs (spec edits in design/*.md) now
# reach the regimes the sweep found them missing. Unlike checks 6-13 (a PASSING
# check documents an UNreached regime), here a PASSING check is evidence the
# REPAIRED gate is now live: each asserts the repaired fixture/pin reaches the
# predicate its gate exists to exercise.

def check_applied_repairs():
    print("\n14. The vacuity-sweep repairs reach their regimes  [design/*.md edits 2026-07-23]")

    # --- §2.1 A-AN-BRAKE / A-AN-RK4: the restated closed forms (ramp term) are satisfiable
    def ramp(v0, a_target, slew=A_SLEW_DEFAULT):
        t_r = abs(a_target) / slew
        sign = 1.0 if a_target > 0 else -1.0
        return (v0 * t_r + sign * slew * t_r ** 3 / 6,
                v0 + sign * slew * t_r ** 2 / 2, t_r)
    v0 = 100 / 3.6
    dx, v1, t_r = ramp(v0, -3.0)
    restated = 50 + dx + (v1 ** 2 - V_FLOOR ** 2) / (2 * 3.0)
    check("A-AN-BRAKE: the restated s* (with ramp term) = 184.85 m matches the slewed truth",
          abs(restated - 184.85) < 0.01,
          f"restated design value 184.85 m vs integrated {restated:.4f} m — a correct "
          f"slew-limited engine now passes; the retracted 177.93 m could not")
    t_r2 = 2.0 / A_SLEW_DEFAULT
    v1_rk4 = 10.0 + A_SLEW_DEFAULT * t_r2 ** 2 / 2
    check("A-AN-RK4: the restated post-ramp v1 = 10.333 m/s (10 + (slew/2)*t_r^2) is exact",
          abs(v1_rk4 - 10.3333) < 1e-3,
          f"v1 {v1_rk4:.4f} m/s — RK4 is exact on each polynomial arc (cubic then quadratic in t)")

    # --- §2.2 A-SSD-GOVERNOR: the pinned vis_margin=1.4 binds the V1 governor (strict < has a witness)
    entry, r, sweep = 16.0, 12.0, 140.0
    v = 34 / 3.6
    pt, s_end = road(entry, r, sweep)
    poly = hedge_polygon(pt, entry - 6.0, entry + 36.0, 1.2, 2.5)
    worst_sight, worst_ssd = math.inf, 0.0
    for f in (1.0, 0.0):
        d = BIKE_MARGIN + f * (LANE_W - 2 * BIKE_MARGIN)
        phi = math.atan(v * v / (G * (r + d)))
        worst_ssd = max(worst_ssd, ssd(v, phi))
        s_eye = entry - 4.0
        while s_eye < s_end:
            sl = sight_from(pt, poly, s_eye, f, s_end + 25)
            if sl is not None:
                worst_sight = min(worst_sight, sl - s_eye)
            s_eye += 0.5
    check("A-SSD-GOVERNOR: the pinned vis_margin=1.4 binds the governor (1.4*ssd > min sight)",
          1.4 * worst_ssd > worst_sight,
          f"1.4*{worst_ssd:.2f} = {1.4*worst_ssd:.2f} m > min sight {worst_sight:.2f} m -> governed "
          f"< ungoverned has a witness; the same strict < at default 1.0 ({worst_ssd:.2f} <= "
          f"{worst_sight:.2f}) would silently FAIL — why the pin must precede the strengthen")

    # --- §2.6 P-VIS-BOUNDED FX-VIS-FLOOR: vis_margin=12 drives the governed speed below v_floor
    ssd_floor = ssd(V_FLOOR, 0.0)
    check("P-VIS-BOUNDED FX-VIS-FLOOR: vis_margin=12 exceeds sight even at v_floor -> floor refusal",
          12.0 * ssd_floor > worst_sight,
          f"12 * ssd(v_floor={V_FLOOR}) = {12.0*ssd_floor:.2f} m > sight {worst_sight:.2f} m: no "
          f"speed >= v_floor satisfies the governor, so vis_speed_below_model_floor is reachable "
          f"(the refusal arm is no longer a dead branch)")

    # --- Q3: bookDoubleApex's opening middle corner (R24) sits OUTSIDE the [0.65,0.90] band
    v_da = 30.0 / 3.6
    R_res_da = v_da * v_da / 8.3385
    c1_ratio, c2_ratio = R_res_da / 12.0, R_res_da / 24.0
    check("Q3: bookDoubleApex c2 (R24) R_res/R_road = 0.35 is OUTSIDE the claimed [0.65,0.90]",
          c2_ratio < 0.65 and abs(c2_ratio - 0.347) < 0.01,
          f"c1/c3 (R12) {c1_ratio:.3f}, c2 (R24) {c2_ratio:.3f} — benign (< 1, tighter reserve); "
          f"fixed by the two added rows in 04 §4c.4 and the one-sided < 1 restatement")

    # --- §2.9 P-RUNWIDE-UPRIGHT F-AN-NEARUPRIGHT: |phi|=1.9 deg gives a NON-zero stand-up envelope
    env = math.tanh(1.9 / PHI0_DEG)
    check("P-RUNWIDE-UPRIGHT: the added |phi|=1.9deg fixture has a non-zero tanh envelope (0.36)",
          env > 0.3,
          f"tanh(1.9/{PHI0_DEG:.0f}) = {env:.3f} vs 0 at phi=0 — the slice term is now exercised, "
          f"not killed by its envelope, and its contribution is bounded (<= eps_m = 0.05 m)")

    note("§2.12 fx-hedge-gap: the authored DSL maps to check 13's proven gap",
         "`hedge inside c1 -6x4` = stations 10-14, `+2x28` = stations 18-46 on bookBlind "
         "(entry:c1 = 16); the 4 m gap over 14-18 is check 13's entrance gap that threads.")
    note("Q1/Q2 narrowing is verified by check 1",
         "the doctrinal-turn-in scope now stated in 09 L757 / 01 / 00-README / 03 §3.1 is exactly "
         "check 1's two PASSes: not blind at the doctrinal turn-in, blind at an early one.")


def check_chain_vis():
    print("\n15. fx-chain-blind — the >=130-degree same-hand chained-visibility fixture  [09 §3.5]")
    print("    lane 3.5 | S 16 | L 12 ^140 | S <gap> | L 12 ^140 | S 16, entry 39 km/h,")
    print("    hedge inside c1,c2 margin=0.3 depth=2.5, vis_margin 1.2. Each leg is a single")
    print("    L 12 ^140 corner (blindness already proven at every cell by check 1); this check")
    print("    adds the governor binding, the gap regimes, and the same-hand justification.")
    R, SW, ENTRY_S = 12.0, 140.0, 16.0
    v = 39 / 3.6
    pt, se = road(ENTRY_S, R, SW)
    poly = hedge_polygon(pt, ENTRY_S - 6.0, ENTRY_S + 30, 0.3, 2.5)      # left leg, margin 0.3

    # (a) blind on the DOCTRINAL hold-wide (f=1.0) line across the turn-in band
    blind_doc = True
    ti = ENTRY_S - 4.0
    while ti <= ENTRY_S + 4.0 + 1e-9:
        sl = sight_from(pt, poly, ti, 1.0, se + 30)
        blind_doc &= (sl is not None and sl < se)
        ti += 0.5
    check("each ^140 leg is blind on the DOCTRINAL hold-wide line (fixes fx-esses-blind's inversion)",
          blind_doc, "same-hand left legs keep `inside` across the centreline, so hold-wide is "
          "blind, not merely the cut-in line")

    # (b) governor: min sight_ride on the hold-wide line vs vis_margin * ssd
    msr, s_eye = math.inf, ENTRY_S - 4.0
    while s_eye < se:
        sl = sight_from(pt, poly, s_eye, 1.0, se + 30)
        if sl is not None:
            msr = min(msr, sl - s_eye)
        s_eye += 0.5
    phi_wide = math.atan(v * v / (G * (R + BIKE_MARGIN + (LANE_W - 2 * BIKE_MARGIN))))
    ssd_m = ssd(v, phi_wide)
    ratio = msr / ssd_m
    check("V1 governor BINDS at vis_margin=1.2 on the hold-wide line, and is inert at 1.0",
          1.0 <= ratio < 1.2,
          f"sight_ride {msr:.2f} m / ssd {ssd_m:.2f} m = {ratio:.3f} in [1.0, 1.2) — bound at 1.2, "
          f"inert at 1.0 (blind(c) alone leaves V1 inert; the entry speed is what makes it bind)")

    # (c) the cut-in reference line stays ridable at 39 km/h
    lean_cut = math.degrees(math.atan(v * v / (G * (R + BIKE_MARGIN))))
    check("cut-in line stays ridable at 39 km/h (lean < phiMax 45)", lean_cut < 45.0,
          f"cut-in lean {lean_cut:.1f} deg; the window ceiling is ~40 km/h (cut-in reaches 45), "
          f"the floor ~38 (below it V1 no longer binds at 1.2)")

    # (d) gap regimes: S 18 full hold; S 12 budget-limited but non-zero
    A_LAT, K_REACH, MIN_DD = 0.8, 1.2, 0.10
    T_ROLL = math.atan(A_LAT / G) / math.radians(50.0)
    target = 0.1 * (LANE_W - 2 * BIKE_MARGIN)
    L_req = 2 * v * (math.sqrt(K_REACH * target / A_LAT) + T_ROLL)
    dd = lambda gap: A_LAT * max(0.0, (gap / v) / 2 - T_ROLL) ** 2
    check("FULL variant `S 18` makes the hold reachable (gap >= L_req)", 18.0 >= L_req,
          f"L_req(0.27, 39) = {L_req:.2f} m <= 18 m; dd_max(S 18) = {dd(18.0):.3f} m > target {target:.2f}")
    check("BUDGET variant `S 12` is budget-limited but non-zero (MIN_POS_DD_M <= dd < target)",
          MIN_DD <= dd(12.0) < target,
          f"dd_max(S 12) = {dd(12.0):.3f} m in [{MIN_DD}, {target:.2f}) -> a hold is emitted, "
          f"budget_limited; a zero gap would emit none and empty the monotone-span quantifier")
    check("stays in scope and holds the proportion band",
          SW < 170.0 and 0.55 <= 2 * LANE_W / R <= 0.9,
          f"sweep {SW:.0f} < 170; road:radius = {2 * LANE_W / R:.3f}")

    # (e) same-hand is required: a right leg inverts (hold-wide blinder than cut-in)
    ptR, seR = road(ENTRY_S, R, SW, hand="R")
    polyR = hedge_polygon(ptR, ENTRY_S - 6.0, ENTRY_S + 30, 0.3, 2.5, side=+1)
    w = sight_from(ptR, polyR, ENTRY_S, 1.0, seR + 30)
    c = sight_from(ptR, polyR, ENTRY_S, 0.0, seR + 30)
    check("SAME-HAND is required: a right leg inverts (hold-wide sees LESS than the cut-in line)",
          w is not None and c is not None and w < c,
          f"right-hander: hold-wide s_limit {w:.2f} < cut-in {c:.2f} -> `hold_wide_for_sight` would "
          f"grade the doctrine backwards; hand-reversal coverage stays on bookEsses (G-COMMIT-ESSES)")


def check_constraint_hard():
    print("\n16. F-CONSTRAINT-HARD — R 25 ^90 @55 (was mislabeled R6; now A-RECIPE-F + "
          "P-ACCEPT-CONSTRAINT)  [09 §3.5, 08 §6(f)]")
    v = 55 / 3.6
    R = 25.0
    # right-hander: offset d right-of-travel is toward the arc centre -> ride radius R - d
    d_inside = BIKE_MARGIN + (LANE_W - 2 * BIKE_MARGIN)   # 3.10 m, the tight lane edge
    d_outer = BIKE_MARGIN                                 # 0.40 m, the wide lane edge
    lean_in = math.degrees(math.atan(v * v / (G * (R - d_inside))))
    lean_out = math.degrees(math.atan(v * v / (G * (R - d_outer))))
    check("the inside line is UNRIDABLE at 55 km/h (needs > phiMax 45)", lean_in > 45.0,
          f"R_ride {R - d_inside:.1f} m -> {lean_in:.2f} deg > 45 (matches 09's 47.37) — so a "
          f"hard f-constraint on a lean-failing line is the natural best-failing case")
    check("a ridable wide line still exists (the solve is not vacuously all-NO_SOLUTION)", lean_out < 45.0,
          f"R_ride {R - d_outer:.1f} m -> {lean_out:.2f} deg < 45; the f>=0.6 'stay wide' constraint "
          f"is what rescues ridability")
    note("R6 and F-CONSTRAINT-HARD are two different fixtures (the former double-definition)",
         "R6 = R 12 ^90 @34 (P-CONSTRAINT-BINDING, comfortable, constraint merely reshapes); "
         "F-CONSTRAINT-HARD = R 25 ^90 @55 (A-RECIPE-F + P-ACCEPT-CONSTRAINT, at the lean ceiling).")


if __name__ == "__main__":
    print("linelab — geometric claims in design/, re-derived from the DSL")
    print("Checks 1-5 audit D46 (2026-07-19); 6-9 the vacuity sweep (2026-07-20);")
    print("10-13 the four formerly-uncovered quantities + the Q1/Q2 turn-in fix in check 1")
    print("(2026-07-22); 15-16 the roadblock resolutions (2026-07-23) — fx-chain-blind and")
    print("F-CONSTRAINT-HARD. The six book-figure scenes are now authored (figures/*.scene);")
    print("baking them needs the engine, so this checker still covers geometry only.")
    print("=" * 68)
    check_blind_fixture()
    check_blind_lean_cap()
    check_envelope_contains_corpus()
    check_ladder()
    check_escape_reach()
    check_analytic_slew()
    check_ssd_governor()
    check_right_hand_inside_band()
    check_tightening_is_identity()
    check_c30_dr_taper()
    check_r_res()
    check_l_req()
    check_fx_hedge_gap()
    check_applied_repairs()
    check_chain_vis()
    check_constraint_hard()
    print("\n" + "=" * 68)
    if _fail:
        print(f"{len(_fail)} assertion(s) contradict the design of record:")
        for f in _fail:
            print(f"  - {f}")
    else:
        print("all assertions hold")
