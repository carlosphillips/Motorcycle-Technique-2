/**
 * kappa(v, phi) = G·tan(phi)/v² [1/m] — the model's heart (02 §2). `v` is
 * floored at V_MIN_RHS exactly as inside an integrator stage (02 §6), so the
 * identity is total.
 */
export declare function kappa(v: number, phi: number): number;
/** aLat(v, kappa) = v²·kappa ( ≡ G·tan(phi) ) [m/s²] (02 §2). */
export declare function aLat(v: number, kappa_1pm: number): number;
/** requiredLean(v, kappa) = atan(v²·kappa/G) [rad] (02 §2). */
export declare function requiredLean(v: number, kappa_1pm: number): number;
/** speedForLean(r, phi) = sqrt(G·r·tan(phi)) [m/s] ( v ∝ √r ) (02 §2). */
export declare function speedForLean(r_m: number, phi: number): number;
/** aLatMax(mu) = mu·G [m/s²] (02 §4). */
export declare function aLatMax(mu: number): number;
/** aLongMax(mu) = mu·G [m/s²] (02 §4). */
export declare function aLongMax(mu: number): number;
/** phiMax(mu) = atan(mu) [rad] ( 45.0° at mu = 1.0 ) (02 §4). */
export declare function phiMax(mu: number): number;
/** ellipseMag(aLong, aLat, mu) = sqrt((aLong/aLongMax)² + (aLat/aLatMax)²) (02 §4). */
export declare function ellipseMag(aLong: number, aLat_ms2: number, mu: number): number;
/** gripMargin(aLong, aLat, mu) = 1 − ellipseMag — three-argument form (ARCHITECTURE §10.14). */
export declare function gripMargin(aLong: number, aLat_ms2: number, mu: number): number;
/**
 * aLongAvail(aLat, mu) = aLongMax·sqrt(max(0, 1 − (aLat/aLatMax)²)) [m/s²]
 * (02 §4) — the per-stage clip ceiling; the trajectory can never transiently
 * leave the grip circle mid-step.
 */
export declare function aLongAvail(aLat_ms2: number, mu: number): number;
/** mu_use = skill·mu (02 §4). */
export declare function muUse(skill: number, mu: number): number;
/** aLatReserve(muUse) = muUse·G [m/s²] — advisory reserve, never a ceiling (02 §4). */
export declare function aLatReserve(muUse_: number): number;
/** phiReserve(muUse) = atan(muUse) [rad] ( 40.36° at skill 0.85, mu 1.0 ) (02 §4). */
export declare function phiReserve(muUse_: number): number;
/** The tanh continuity envelope T = tanh(|phi|/PHI0), PHI0 in degrees (02 §5.2). */
export declare function tanhEnvelope(phi: number): number;
/**
 * b_dem = clamp(−a_cmd, 0, aLongMax(mu)) — the grip-capped braking DEMAND the
 * sustained term keys on (02 §5.2). Physical ceiling, never skill-derated.
 */
export declare function bDem(a_cmd: number, mu: number): number;
/** S_sustained = K_SU · relu(b_dem − A_SU_ONSET) [rad/s] (02 §5.2). */
export declare function sSustained(b_dem: number): number;
/** S_transient = K_CHOP · relu(−a_cmd_rate − RATE_THRESHOLD) [rad/s] (02 §5.2). */
export declare function sTransient(a_cmd_rate: number): number;
/**
 * The sustained stand-up contribution −sign(phi)·S_sustained·T [rad/s],
 * post-envelope — the recorded `su_sustained` channel in rad/s (05 §2.1).
 * Exactly 0 (never −0) when inactive, so the §5.4.1 bit-identity is visible.
 */
export declare function suSustained(phi: number, a_cmd: number, mu: number): number;
/** The transient stand-up contribution −sign(phi)·S_transient·T [rad/s] (05 §2.1). */
export declare function suTransient(phi: number, a_cmd_rate: number): number;
/**
 * phi_dot_su = −sign(phi)·[S_sustained + S_transient]·tanh(|phi|/PHI0) [rad/s]
 * (02 §5.2, normative). Per ARCHITECTURE §10.10 it has NO a_clip dependence:
 * per-stage variation enters via sign(phi)/tanh only; `b_dem` uses the step's
 * ZOH a_cmd and `a_cmd_rate` is the step's ZOH rate.
 */
export declare function phiDotSu(phi: number, a_cmd: number, a_cmd_rate: number, mu: number): number;
/**
 * a_noreturn(phi, roll_rate) = A_SU_ONSET + roll_rate/(K_SU·tanh(|phi|/PHI0))
 * [m/s²] — teaching quantity ONLY, not a path-widening threshold (02 §5.3).
 * `roll_rate` in rad/s (the effective rate). +Infinity at phi = 0 (the
 * envelope vanishes; no commandable brake stands an upright bike up).
 */
export declare function aNoReturn(phi: number, roll_rate: number): number;
/**
 * a_widen(phi, v; c) = (c·roll_rate + K_SU·A_SU_ONSET·T)/(K_SU·T − sin(2phi)/v)
 * [m/s²] — the unclipped-regime widening onset and the HUD/teaching quantity
 * (02 §5.3). `null` where the denominator ≤ 0 (no commandable brake widens —
 * the low-speed validity floor). `c` is the counter-command fraction
 * (1 = fighting rider, 0 = frozen).
 */
export declare function aWiden(phi: number, v: number, c: number, roll_rate: number): number | null;
/**
 * Predicate (W) — the normative instantaneous widening predicate (02 §5.3),
 * covering both regimes with b_del = min(b_dem, aLongAvail(phi)) substituted:
 *
 *   K_SU·relu(b_dem − A_SU_ONSET)·T − c·roll_rate  >  b_del·sin(2|phi|)/v
 *
 * True ⇒ the path itself opens (kappa falls) at this instant.
 */
export declare function widensW(phi: number, v: number, b_dem: number, c: number, roll_rate: number, mu: number): boolean;
export declare const PHI_VALID_MIN_DEG = 2;
