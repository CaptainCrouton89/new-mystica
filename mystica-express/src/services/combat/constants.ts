import { HitBand } from './types.js';

export const ZONE_MULTIPLIERS = {
  1: 1.5,
  2: 1.25,
  3: 1.0,
  4: 0.75,
  5: 0.5,
} as const;

export const MIN_DAMAGE = 1;

export const MAX_CRIT_BONUS = 1.0;

export const HIT_BAND_TO_ZONE: Record<HitBand, 1 | 2 | 3 | 4 | 5> = {
  'crit': 1,
  'normal': 2,
  'graze': 3,
  'miss': 4,
  'injure': 5
};

export const DEFAULT_WEAPON_CONFIG = {
  pattern: 'single_arc' as const,
  spin_deg_per_s: 180,
  adjusted_bands: {
    deg_crit: 10,
    deg_normal: 20,
    deg_graze: 110,
    deg_miss: 110,
    deg_injure: 110,
    total_degrees: 360,
  },
};

export const SESSION_EXPIRY_MS = 15 * 60 * 1000;
