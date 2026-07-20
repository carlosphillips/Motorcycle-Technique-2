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

def road(entry_straight, radius, sweep_deg):
    """Return (point_at_station, s_end_of_corner). Left-hand corner, centre to the left."""
    tm = math.radians(sweep_deg)

    def pt(s):
        if s <= entry_straight:
            return (s, 0.0), 0.0
        th = (s - entry_straight) / radius
        if th <= tm:
            return (entry_straight + radius * math.sin(th),
                    radius - radius * math.cos(th)), th
        ex = (entry_straight + radius * math.sin(tm), radius - radius * math.cos(tm))
        d = s - entry_straight - radius * tm
        return (ex[0] + d * math.cos(tm), ex[1] + d * math.sin(tm)), tm

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


def hedge_polygon(pt, s_from, s_to, margin, depth, n=500):
    """Band `inside` a left-hander: d < 0, from margin outside the edge, depth further."""
    inner, outer = -(LANE_W + margin), -(LANE_W + margin + depth)
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

    print("\n   Is blind(c) reachable by a 90-degree corner? Sweep radius AND hedge margin.")
    print("   blind(c) is a PER-LINE predicate (the eye is the rider's own position, 03 §5.1),")
    print("   so it is reported separately for the hold-wide line and for any line at all.")
    print("     R     margin  s_end   min s_limit(any line)  blind  | hold-wide blind?")
    any_cell = wide_any = False
    for R in (9.0, 12.0, 12.7):
        for m in (0.0, 0.5, 1.2):
            pt, se = road(12.0, R, 90.0)
            poly = hedge_polygon(pt, 6.0, se + 1.5, m, 2.5)
            best, ti = math.inf, 8.0
            wide = True
            while ti < se:
                for j in range(6):
                    sl = sight_from(pt, poly, ti, j / 5, se + 25)
                    if sl is not None:
                        best = min(best, sl)
                w = sight_from(pt, poly, ti, 1.0, se + 25)
                wide &= (w is not None and w < se)
                ti += 1.0
            any_cell |= best < se
            wide_any |= wide
            print(f"     {R:4.1f}  {m:4.2f}   {se:6.2f}  {best:12.2f}         "
                  f"{str(best < se):5s}  | {wide}")
    check("no 90-degree corner is blind on the HOLD-WIDE line at any legal margin",
          not wide_any,
          "this is the claim that justifies reshaping the fixture — the doctrinal line "
          "(rider.start.f default 1.0) never loses sight of the exit")
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


if __name__ == "__main__":
    print("linelab — geometric claims in design/, re-derived from the DSL")
    print("NOT covered here (prose-only in design/): fx-hedge-gap, C30-DR's taper")
    print("rate, L_req's derivation, R_res. Do not read a clean run as full cover.")
    print("=" * 68)
    check_blind_fixture()
    check_blind_lean_cap()
    check_envelope_contains_corpus()
    check_ladder()
    check_escape_reach()
    print("\n" + "=" * 68)
    if _fail:
        print(f"{len(_fail)} assertion(s) contradict the design of record:")
        for f in _fail:
            print(f"  - {f}")
    else:
        print("all assertions hold")
