// core/slice.ts — the run-wide slice v2 (design/02 §5, D14) plus the kappa/lean
// algebra family (02 §2) and the friction-ellipse / one-μ reserve families
// (02 §4). ARCHITECTURE §5 pins these as core exports without a file pin; they
// are homed here because the slice, the stepper, and the steering machine all
// consume them and this is the one physics-algebra module of the engine
// (recorded WP-04 judgment call).
//
// Sign/unit conventions (ARCHITECTURE §6.1): all `phi` arguments are RADIANS,
// positive = right lean. `PHI0` is authored in degrees (02 §5.2), so the tanh
// envelope converts via core/units.ts — never an inline factor (drift risk #1).
import { G, A_SU_ONSET, K_SU, K_CHOP, RATE_THRESHOLD, PHI0, V_MIN_RHS } from "./constants.js";
import { radToDeg } from "./units.js";
// ---------------------------------------------------------------------------
// §2 — the emergent-curvature identity and its algebraic family
/**
 * kappa(v, phi) = G·tan(phi)/v² [1/m] — the model's heart (02 §2). `v` is
 * floored at V_MIN_RHS exactly as inside an integrator stage (02 §6), so the
 * identity is total.
 */
export function kappa(v, phi) {
    const vf = Math.max(v, V_MIN_RHS);
    return (G * Math.tan(phi)) / (vf * vf);
}
/** aLat(v, kappa) = v²·kappa ( ≡ G·tan(phi) ) [m/s²] (02 §2). */
export function aLat(v, kappa_1pm) {
    return v * v * kappa_1pm;
}
/** requiredLean(v, kappa) = atan(v²·kappa/G) [rad] (02 §2). */
export function requiredLean(v, kappa_1pm) {
    return Math.atan((v * v * kappa_1pm) / G);
}
/** speedForLean(r, phi) = sqrt(G·r·tan(phi)) [m/s] ( v ∝ √r ) (02 §2). */
export function speedForLean(r_m, phi) {
    return Math.sqrt(G * r_m * Math.tan(phi));
}
// ---------------------------------------------------------------------------
// §4 — the friction ellipse and the one-μ policy (hard ceilings from physical mu)
/** aLatMax(mu) = mu·G [m/s²] (02 §4). */
export function aLatMax(mu) {
    return mu * G;
}
/** aLongMax(mu) = mu·G [m/s²] (02 §4). */
export function aLongMax(mu) {
    return mu * G;
}
/** phiMax(mu) = atan(mu) [rad] ( 45.0° at mu = 1.0 ) (02 §4). */
export function phiMax(mu) {
    return Math.atan(mu);
}
/** ellipseMag(aLong, aLat, mu) = sqrt((aLong/aLongMax)² + (aLat/aLatMax)²) (02 §4). */
export function ellipseMag(aLong, aLat_ms2, mu) {
    const nl = aLong / aLongMax(mu);
    const nt = aLat_ms2 / aLatMax(mu);
    return Math.sqrt(nl * nl + nt * nt);
}
/** gripMargin(aLong, aLat, mu) = 1 − ellipseMag — three-argument form (ARCHITECTURE §10.14). */
export function gripMargin(aLong, aLat_ms2, mu) {
    return 1 - ellipseMag(aLong, aLat_ms2, mu);
}
/**
 * aLongAvail(aLat, mu) = aLongMax·sqrt(max(0, 1 − (aLat/aLatMax)²)) [m/s²]
 * (02 §4) — the per-stage clip ceiling; the trajectory can never transiently
 * leave the grip circle mid-step.
 */
export function aLongAvail(aLat_ms2, mu) {
    const cap = aLongMax(mu);
    const r = aLat_ms2 / cap;
    return cap * Math.sqrt(Math.max(0, 1 - r * r));
}
// ---------------------------------------------------------------------------
// §4 — the reserve family (skill derating exists ONLY here; the naming is the
// guard rail: reserve functions demand an already-derated argument)
/** mu_use = skill·mu (02 §4). */
export function muUse(skill, mu) {
    return skill * mu;
}
/** aLatReserve(muUse) = muUse·G [m/s²] — advisory reserve, never a ceiling (02 §4). */
export function aLatReserve(muUse_) {
    return muUse_ * G;
}
/** phiReserve(muUse) = atan(muUse) [rad] ( 40.36° at skill 0.85, mu 1.0 ) (02 §4). */
export function phiReserve(muUse_) {
    return Math.atan(muUse_);
}
// ---------------------------------------------------------------------------
// §5.2 — the run-wide slice v2
/** relu helper (02 §5.2 spells `relu(·)`). */
function relu(x) {
    return x > 0 ? x : 0;
}
/** The tanh continuity envelope T = tanh(|phi|/PHI0), PHI0 in degrees (02 §5.2). */
export function tanhEnvelope(phi) {
    return Math.tanh(radToDeg(Math.abs(phi)) / PHI0);
}
/**
 * b_dem = clamp(−a_cmd, 0, aLongMax(mu)) — the grip-capped braking DEMAND the
 * sustained term keys on (02 §5.2). Physical ceiling, never skill-derated.
 */
export function bDem(a_cmd, mu) {
    return Math.min(Math.max(0, -a_cmd), aLongMax(mu));
}
/** S_sustained = K_SU · relu(b_dem − A_SU_ONSET) [rad/s] (02 §5.2). */
export function sSustained(b_dem) {
    return K_SU * relu(b_dem - A_SU_ONSET);
}
/** S_transient = K_CHOP · relu(−a_cmd_rate − RATE_THRESHOLD) [rad/s] (02 §5.2). */
export function sTransient(a_cmd_rate) {
    return K_CHOP * relu(-a_cmd_rate - RATE_THRESHOLD);
}
/**
 * The sustained stand-up contribution −sign(phi)·S_sustained·T [rad/s],
 * post-envelope — the recorded `su_sustained` channel in rad/s (05 §2.1).
 * Exactly 0 (never −0) when inactive, so the §5.4.1 bit-identity is visible.
 */
export function suSustained(phi, a_cmd, mu) {
    const v = -Math.sign(phi) * sSustained(bDem(a_cmd, mu)) * tanhEnvelope(phi);
    return v === 0 ? 0 : v;
}
/** The transient stand-up contribution −sign(phi)·S_transient·T [rad/s] (05 §2.1). */
export function suTransient(phi, a_cmd_rate) {
    const v = -Math.sign(phi) * sTransient(a_cmd_rate) * tanhEnvelope(phi);
    return v === 0 ? 0 : v;
}
/**
 * phi_dot_su = −sign(phi)·[S_sustained + S_transient]·tanh(|phi|/PHI0) [rad/s]
 * (02 §5.2, normative). Per ARCHITECTURE §10.10 it has NO a_clip dependence:
 * per-stage variation enters via sign(phi)/tanh only; `b_dem` uses the step's
 * ZOH a_cmd and `a_cmd_rate` is the step's ZOH rate.
 */
export function phiDotSu(phi, a_cmd, a_cmd_rate, mu) {
    return suSustained(phi, a_cmd, mu) + suTransient(phi, a_cmd_rate);
}
// ---------------------------------------------------------------------------
// §5.3 — the two crossovers and the widening predicate
/**
 * a_noreturn(phi, roll_rate) = A_SU_ONSET + roll_rate/(K_SU·tanh(|phi|/PHI0))
 * [m/s²] — teaching quantity ONLY, not a path-widening threshold (02 §5.3).
 * `roll_rate` in rad/s (the effective rate). +Infinity at phi = 0 (the
 * envelope vanishes; no commandable brake stands an upright bike up).
 */
export function aNoReturn(phi, roll_rate) {
    const t = tanhEnvelope(phi);
    if (t <= 0)
        return Number.POSITIVE_INFINITY;
    return A_SU_ONSET + roll_rate / (K_SU * t);
}
/**
 * a_widen(phi, v; c) = (c·roll_rate + K_SU·A_SU_ONSET·T)/(K_SU·T − sin(2phi)/v)
 * [m/s²] — the unclipped-regime widening onset and the HUD/teaching quantity
 * (02 §5.3). `null` where the denominator ≤ 0 (no commandable brake widens —
 * the low-speed validity floor). `c` is the counter-command fraction
 * (1 = fighting rider, 0 = frozen).
 */
export function aWiden(phi, v, c, roll_rate) {
    const t = tanhEnvelope(phi);
    const den = K_SU * t - Math.sin(2 * Math.abs(phi)) / Math.max(v, V_MIN_RHS);
    if (den <= 0)
        return null;
    return (c * roll_rate + K_SU * A_SU_ONSET * t) / den;
}
/**
 * Predicate (W) — the normative instantaneous widening predicate (02 §5.3),
 * covering both regimes with b_del = min(b_dem, aLongAvail(phi)) substituted:
 *
 *   K_SU·relu(b_dem − A_SU_ONSET)·T − c·roll_rate  >  b_del·sin(2|phi|)/v
 *
 * True ⇒ the path itself opens (kappa falls) at this instant.
 */
export function widensW(phi, v, b_dem, c, roll_rate, mu) {
    const t = tanhEnvelope(phi);
    const b_del = Math.min(b_dem, aLongAvail(G * Math.tan(Math.abs(phi)), mu));
    const lhs = K_SU * relu(b_dem - A_SU_ONSET) * t - c * roll_rate;
    const rhs = (b_del * Math.sin(2 * Math.abs(phi))) / Math.max(v, V_MIN_RHS);
    return lhs > rhs;
}
// ---------------------------------------------------------------------------
// §7 — the model-validity band's lean floor (unnamed design literal "2°",
// local name per ARCHITECTURE §6.6; below_validity ⇔ v < v_valid_min_ms ∧
// |phi| ≥ PHI_VALID_MIN_DEG — straight-line stops never flag)
export const PHI_VALID_MIN_DEG = 2;
//# sourceMappingURL=slice.js.map