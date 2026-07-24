import type { SsdModel } from "../core/types.js";
/** design/03 §6 field notes (L624) / constants table (L336). */
export declare const CONFIG_MU_DEFAULT = 1;
/**
 * design/03 §6 (L624/L337): `config.ds_m` default 0.5 m — the SAME value as
 * core's resample-grid `ds_m`, imported (not re-declared) so the two never drift.
 */
export declare const CONFIG_DS_M_DEFAULT: number;
/** design/03 §6 (L624/L338). */
export declare const CONFIG_SSD_MODEL_DEFAULT: SsdModel;
/** design/03 §6 (L625/L339); the only legal rubric name in v0.1 (ARCHITECTURE §10 pin #20's CLI rule mirrored at the wire field). */
export declare const CONFIG_RUBRIC_DEFAULT = "parks-street";
/** design/03 §6 (L631/L340); the only legal checks_version literal in v0.1. */
export declare const CONFIG_CHECKS_VERSION_DEFAULT: 2;
/** design/03 §2/§6 (L620/L335) — the outer usable edge, the doctrinal entry position. */
export declare const START_F_DEFAULT = 1;
