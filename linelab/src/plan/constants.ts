// plan/constants.ts — design/03-owned SCENARIO CONFIG DEFAULTS (ARCHITECTURE §6.6:
// one constants.ts per owning module). Occluder/hazard geometry defaults live at
// road/constants.ts (already the owning module for §4's band/vehicle/gravel
// table); rider/physics constants (K_REACH, a_lat_pos_max, PHI_TRACK_AUTH_DEG,
// roll rates, …) live at core/constants.ts — imported here, never re-declared.

import type { SsdModel } from "../core/types.js";
import { ds_m as DS_M_DEFAULT } from "../core/constants.js";

/** design/03 §6 field notes (L624) / constants table (L336). */
export const CONFIG_MU_DEFAULT = 1.0;

/**
 * design/03 §6 (L624/L337): `config.ds_m` default 0.5 m — the SAME value as
 * core's resample-grid `ds_m`, imported (not re-declared) so the two never drift.
 */
export const CONFIG_DS_M_DEFAULT: number = DS_M_DEFAULT;

/** design/03 §6 (L624/L338). */
export const CONFIG_SSD_MODEL_DEFAULT: SsdModel = "alert";

/** design/03 §6 (L625/L339); the only legal rubric name in v0.1 (ARCHITECTURE §10 pin #20's CLI rule mirrored at the wire field). */
export const CONFIG_RUBRIC_DEFAULT = "parks-street";

/** design/03 §6 (L631/L340); the only legal checks_version literal in v0.1. */
export const CONFIG_CHECKS_VERSION_DEFAULT = 2 as const;

/** design/03 §2/§6 (L620/L335) — the outer usable edge, the doctrinal entry position. */
export const START_F_DEFAULT = 1.0;
