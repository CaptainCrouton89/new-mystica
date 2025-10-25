# Enemy Type Styles Refactoring - Requirements

**Feature ID:** (TBD - assign during project documentation integration)
**Status:** incomplete
**Created:** 2025-10-24
**Updated:** 2025-10-25

## Overview

**Purpose:** Refactor enemy styling from one-to-one to many-to-many relationship with probabilistic selection

**User Benefit:** Enables visual variety for enemy types without creating duplicate enemy definitions; allows designers to configure style probabilities for more dynamic encounters

**Problem:** Currently each enemy type has a single static `style_id`. To create visual variants (e.g., Red Goblin vs Blue Goblin with same mechanics), duplicate enemy types must be created. This bloats the enemy definitions table and creates maintenance burden.

**Related Documentation:**
- Database: `scripts/migrations/add-enemy-type-styles-junction.sql`
- Service: `mystica-express/src/services/CombatService.ts`
- Service: `mystica-express/src/services/LocationService.ts`
- Repository: `mystica-express/src/repositories/EnemyRepository.ts`
- Types: `mystica-express/src/types/database.types.ts`

## Current State

**Current Data Flow:**
1. `CombatService.startCombat()` triggers enemy selection
2. `LocationService.getMatchingEnemyPools()` finds eligible enemy pools by location and level
3. `LocationService.selectRandomEnemy()` chooses one enemy using weighted pool member selection
4. `EnemyRepository.findEnemyTypeById()` retrieves enemy type with static `style_id`
5. `EnemyRepository.getEnemyRealizedStats()` computes stats via `v_enemy_realized_stats` database view
6. Style applied through:
   - `CombatService.selectEnemy()` populates `style_id` in returned object
   - `CombatService.generateLootFallback()` inherits style for loot generation

**Current Style Impact:**
- Stats: Influenced via database view `v_enemy_realized_stats` (no TypeScript-level multipliers)
- Loot: Passed to `LocationService.selectRandomLoot()` for material/item inheritance
- Name: Retrieved via `LocationService.getStyleName()` for display

## Functional Requirements

### Data Requirements
- **Junction Table:** `enemytypestyles` (already created)
  - Links enemy types to styles with probability weights
  - Unique constraint on `(enemy_type_id, style_id)`
  - Weight stored in `weight_multiplier` column
- **Validation:** Every spawnable enemy type must have ≥1 style entry; weights must be > 0
- **Relationships:** Enemy → multiple Styles (via junction table)

### Style Selection Requirements
- **Selection Timing:** Per-spawn at runtime (when `CombatService.selectEnemy()` is called)
- **Probability Calculation:** Normalize weights by sum; use weighted random selection
- **Selection Scope:** Each enemy spawn independently selects a style (no session-level caching)
- **Error Handling:** Throw error if enemy type has no style entries

### Integration Points
1. **CombatService:** Query styles at spawn time, select one probabilistically
2. **EnemyRepository:** Add method to fetch all styles for an enemy type
3. **LocationService:** No changes required (receives style from CombatService)
4. **Database Types:** Regenerate from Supabase schema to include `enemytypestyles` types

## Technical Requirements

### Performance
- Style selection: O(n) where n = number of styles per enemy type (typically 1-5)
- No caching required; fresh selection at each spawn is acceptable
- Query should use Supabase `.from().select()` pattern (consistent with existing queries)

### Error Handling
- Missing styles for enemy type: Throw error (data integrity issue)
- Style record deleted: Prevent deletion via CASCADE constraint
- Negative/zero weights: Prevent at database level with CHECK constraint

### Implementation Notes

**Repository Pattern to Follow:**
- Use existing Supabase `.from().select()` pattern with filters
- Consistent error handling via `mapSupabaseError()`
- Type-safe queries using generated types from `database.types.ts`

**Probability Normalization:**
- Given styles with weights [1.0, 2.0, 1.0]
- Total = 4.0
- Probabilities = [0.25, 0.5, 0.25]
- Use cumulative distribution for selection

**Data Consistency:**
- Migration already executed; `style_id` still on `enemytypes` (for backwards compatibility during transition)
- No code currently reads from `enemytypestyles` yet
- New code must query junction table, ignoring old `style_id` field

## Success Criteria

- [ ] `EnemyRepository` has method to fetch all styles for an enemy type
- [ ] `CombatService.selectEnemy()` selects style probabilistically based on weights
- [ ] Each enemy spawn independently selects a style (verified with multiple spawns of same type)
- [ ] Style affects stats and loot as before (no regression in gameplay)
- [ ] Error thrown if enemy type has no style entries
- [ ] Database types regenerated to include `enemytypestyles`
- [ ] No API response schema changes (style still returned as single field)

## Out of Scope

- Style-specific stat modifiers (future enhancement)
- Admin UI for managing style weights
- Backwards compatibility for code reading `enemytypes.style_id` (new code queries junction table)
- Audit trail for weight changes (immutability requirement deferred)

## Relevant Files

- `mystica-express/src/services/CombatService.ts` - Enemy spawning and stat calculation
- `mystica-express/src/services/LocationService.ts` - Enemy pool and loot selection
- `mystica-express/src/repositories/EnemyRepository.ts` - Enemy data access
- `mystica-express/src/repositories/BaseRepository.ts` - Repository patterns to follow
- `mystica-express/src/types/database.types.ts` - Generated types from Supabase schema
- `scripts/migrations/add-enemy-type-styles-junction.sql` - Junction table schema
- `mystica-express/src/repositories/LocationRepository.ts` - Loot selection patterns
