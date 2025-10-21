# Combat System TDD Test Suite

## Overview

This document outlines the comprehensive Test-Driven Development (TDD) test suite for the combat system. The tests are designed to **fail until the CombatService is implemented**, providing clear specifications for the expected behavior.

## Test Structure

### Test File: `tests/integration/combat.test.ts`
- **35+ test cases** across 8 major categories
- **All tests currently FAILING** with `501 Not Implemented` (expected for TDD)
- Comprehensive mocking of Supabase, Redis, and external services
- Uses realistic test data from seeded database

## Test Categories & Coverage

### 1. Combat Session Creation (`POST /api/v1/combat/start`)

**Tests:**
- ✅ Create session with enemy from correct pool at valid location
- ✅ Select enemy from level 1 universal pool for new player
- ✅ Select enemy from gym-specific pool with higher weight for Feral Unicorn
- ✅ Scale enemy stats by tier correctly
- ✅ Return 404 for invalid location_id
- ✅ Return 401 without authentication

**Expected Behavior:**
- Query location from database by `location_id`
- Calculate player combat level and stats aggregation
- Select enemy from weighted pools (location-specific or universal fallback)
- Scale enemy stats by tier: `scaled_stat = base_stat * tier`
- Create Redis session with 15-minute TTL
- Return structured response with session, enemy info, and player stats

### 2. Hit Zone Detection (`POST /api/v1/combat/attack`)

**Tests:**
- ✅ Correctly identify injure zone at tap_position=0.0
- ✅ Correctly identify miss, graze, normal, and crit zones
- ✅ Use `fn_weapon_bands_adjusted()` for accuracy scaling
- ✅ Smaller injure/miss zones for high accuracy players

**Expected Behavior:**
- Convert `tap_position` (0.0-1.0) to degrees (0-360)
- Call `fn_weapon_bands_adjusted(p_player_accuracy)` to get scaled weapon bands
- Determine hit zone based on position within weapon band ranges:
  - **Injure**: 0 to `deg_injure`
  - **Miss**: `deg_injure` to `deg_injure + deg_miss`
  - **Graze**: Next `deg_graze` degrees
  - **Normal**: Next `deg_normal` degrees
  - **Crit**: Final `deg_crit` degrees
- High accuracy = smaller injure/miss zones, larger crit zone

### 3. Damage Calculation System

**Tests:**
- ✅ Apply -50% damage multiplier for injure hit (player takes damage)
- ✅ Deal 0 damage for miss hit
- ✅ Deal 60% base damage for graze hit
- ✅ Deal 100% base damage for normal hit
- ✅ Deal 160% + random 0-100% bonus for critical hit
- ✅ Enforce minimum 1 damage
- ✅ Trigger enemy counterattack after player hit
- ✅ Update HP values correctly in session

**Expected Behavior:**
- **Damage Formula**: `(player_ATK * multiplier) - enemy_DEF` (minimum 1)
- **Hit Zone Multipliers**:
  - Injure: Player takes `enemy_ATK - player_DEF` damage
  - Miss: 0 damage
  - Graze: 60% of base damage
  - Normal: 100% of base damage
  - Crit: 160% + random 0-100% bonus
- **Counterattack**: `enemy_ATK - player_DEF` (minimum 1) when player successfully hits
- **Session Updates**: Update player_hp, enemy_hp, turn_number in Redis

### 4. Combat End Conditions

**Tests:**
- ✅ Detect victory when enemy HP reaches 0
- ✅ Detect defeat when player HP reaches 0
- ✅ Continue combat when both combatants alive

**Expected Behavior:**
- **Victory**: `enemy_hp <= 0` → `combat_status = 'victory'`, `combat_complete = true`
- **Defeat**: `player_hp <= 0` → `combat_status = 'defeat'`, `combat_complete = true`
- **Ongoing**: Both HP > 0 → `combat_status = 'ongoing'`, `combat_complete = false`

### 5. Combat Completion & Loot (`POST /api/v1/combat/complete`)

**Tests:**
- ✅ Award loot for victory
- ✅ No loot for defeat
- ✅ Cleanup session after completion
- ✅ Return 404 for invalid session_id

**Expected Behavior:**
- **Victory**: Call `generate_combat_loot(p_combat_level, p_enemy_type_id)` RPC
- **Defeat**: Return `rewards: null`
- **Loot Structure**:
  ```typescript
  {
    gold_earned: number,
    items_found: Array<{item_type_id: string, quantity: number}>,
    materials_found: Array<{material_id: string, style_id: string, quantity: number}>,
    experience_gained: number
  }
  ```
- **Cleanup**: Delete Redis session with `combat:session:${session_id}` key

### 6. Enemy Pool Selection

**Tests:**
- ✅ Select from universal pool when no location-specific pool exists
- ✅ Respect spawn_weight values in enemy selection
- ✅ Match combat_level to enemy pools

**Expected Behavior:**
- Query pools by `combat_level` and `location_type`
- If no location-specific pool found, fallback to universal pool (`location_type = null`)
- Use database's weighted random selection based on `spawn_weight`
- Call `select_enemy_from_pool(p_combat_level, p_location_type)` RPC

### 7. Style Inheritance for Loot

**Tests:**
- ✅ Inherit normal style_id from enemy with normal style
- ✅ Inherit non-normal style_id from styled enemy
- ✅ Use correct drop_weight values for loot pools

**Expected Behavior:**
- **Style Inheritance Rule**: Enemy with `style_id = 'golden'` → all dropped materials have `style_id = 'golden'`
- **Normal Style**: Enemy with `style_id = 'normal'` → materials have `style_id = 'normal'`
- **Loot Generation**: Respect `drop_weight` values in loot pools for rarity distribution

### 8. Session Management & Redis

**Tests:**
- ✅ Return 404 for expired session
- ✅ Return 404 for invalid session_id format
- ✅ Support multiple concurrent sessions for different players
- ✅ Use 15 minute TTL for combat sessions
- ✅ Extend session TTL on each action

**Expected Behavior:**
- **Session Key Format**: `combat:session:${session_id}`
- **TTL**: 900 seconds (15 minutes) on create and refresh
- **Expiration**: Return 404 when session not found in Redis
- **Concurrency**: Each player can have independent combat sessions
- **Validation**: UUIDs only, reject malformed session IDs

## Database Integration Points

### Required RPC Functions
- `fn_weapon_bands_adjusted(p_player_accuracy)` - Scale weapon bands by accuracy
- `fn_expected_mul_quick()` - Combat calculations
- `fn_acc_scale()` - Accuracy scaling
- `combat_rating()` - Player combat level calculation
- `effective_hp()` - HP calculations
- `select_enemy_from_pool(p_combat_level, p_location_type)` - Enemy selection
- `generate_combat_loot(p_combat_level, p_enemy_type_id)` - Loot generation

### Database Tables
- **Locations** - Location lookup and type validation
- **EnemyPools** - Weighted enemy selection by level/location
- **EnemyPoolMembers** - Individual enemies with spawn weights
- **EnemyTypes** - Enemy stats and style information
- **LootPools** - Loot generation by level
- **LootPoolMembers** - Individual loot with drop weights
- **UserEquipment** - Player stat aggregation

## Test Utilities

### Helper Functions (`tests/utils/combat-helpers.ts`)
- `createTestCombatSession()` - Mock combat session data
- `createTestPlayerStats()` - Mock player statistics
- `createTestEnemyData()` - Mock enemy information
- `createTestWeaponBands()` - Mock weapon band data
- `createTestLoot()` - Mock loot rewards
- `determineHitZone()` - Reference hit zone calculation
- `calculateDamage()` - Reference damage calculation

## Current Test Status

**All tests are FAILING as expected for TDD:**
- 32 tests returning `501 Not Implemented`
- 2 tests passing (auth validation)
- 1 test with validation errors (expected)

## Next Steps for Implementation

1. **Create CombatService class** with methods:
   - `startCombat(userId, locationId)`
   - `executeAttack(sessionId, tapPosition)`
   - `completeCombat(sessionId, result)`

2. **Install and configure Redis client**
   - Session storage and management
   - TTL handling

3. **Implement controller methods**
   - Replace `NotImplementedError` throws
   - Call CombatService methods
   - Return structured responses

4. **Add proper error handling**
   - Session validation
   - Database error handling
   - Redis connection handling

5. **Run tests iteratively**
   - Implement one feature at a time
   - Watch tests turn from RED → GREEN
   - Refactor as needed

## Test Execution

```bash
# Run all combat tests
pnpm test tests/integration/combat.test.ts

# Run specific test suite
pnpm test tests/integration/combat.test.ts -t "Combat Session Creation"

# Run with coverage
pnpm test:coverage tests/integration/combat.test.ts
```

This TDD approach ensures that the CombatService implementation will meet all requirements and handle edge cases correctly.