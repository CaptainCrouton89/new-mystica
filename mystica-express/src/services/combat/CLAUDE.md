# Combat Services CLAUDE.md

Modular combat system handling lifecycle from initialization through rewards.

## Files

- `types.ts` - CombatSession, AttackResult, CombatRewards, PlayerStats, EnemyStats
- `constants.ts` - Combat config (damage scaling, base values)
- `session.ts` - Initialize & turn management
- `turn-execution.ts` - Attack/defense mechanics, accuracy calculations
- `calculations.ts` - Damage, stat normalization, zone accuracy
- `session-recovery.ts` - Resume abandoned sessions
- `loot.ts` - Enemy loot pool selection
- `rewards.ts` - Apply gold, XP, materials, items to profile
- `combat-log.ts` - Turn history & events

## Key Patterns

**Imports:** Use relative imports with `.js` extensions (required for Jest)

**Session State:** Atomic RPC to `CombatSessions` table. `session.ts` initializes, `session-recovery.ts` resumes with full context (location, weapon config, stats, enemy data).

**Damage Formula:** `base × level_multiplier × stat_scaling × zone_multiplier`

**Zone Accuracy:** Applied in `turn-execution.ts` via `calculateZoneAccuracy()` (perfect/great/good/poor/miss).

**Reward Pipeline:** `loot.ts` selects items/materials → `rewards.ts` applies to profile (gold/XP/materials/items as JSON in CombatSessions).

**Error Handling:** Custom types (ValidationError, NotFoundError, ExternalAPIError). No silent fallbacks. Middleware catches & formats.

## Type Safety

All types in `types.ts`. Never use `any`—lookup in database.types.ts.

## Dependencies

Repositories: EnemyRepository, ItemRepository, LocationRepository. External: OpenAI (chatter, 2s timeout). Analytics: AnalyticsRepository for logging.
