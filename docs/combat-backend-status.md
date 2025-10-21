# Combat Backend Status

**Last Updated:** 2025-10-21

## ✅ Database Infrastructure Complete (40% Progress)

### PostgreSQL Combat Functions
All combat math functions implemented and tested:
- `fn_weapon_bands_adjusted(weapon_id, player_accuracy)` - Adjusts hit zones based on accuracy
- `fn_expected_mul_quick(weapon_id, player_accuracy)` - Expected damage multiplier
- `fn_acc_scale(accuracy)` - Accuracy scaling with diminishing returns
- `combat_rating(atk, def, hp)` - Power-law combat rating for matchmaking
- `effective_hp(hp, defense)` - Effective HP with diminishing defense returns
- `get_nearby_locations(lat, lng, radius)` - PostGIS geospatial query RPC

### Database Tables
- `CombatSessions` - Ephemeral session storage (0 rows - in-memory/Redis)
- `EnemyTypes` - 5 enemy types seeded (Spray Paint Goblin, Goopy Floating Eye, Feral Unicorn, Bipedal Deer, Politician)
- `EnemyPools` - 11 pools (3 universal, 8 location-specific)
- `EnemyPoolMembers` - 34 weighted enemy assignments
- `LootPools` - 10 universal pools (levels 1-10)
- `LootPoolEntries` - 410 weighted loot entries (materials + item types)
- `Weapons` - Empty (uses default dial config: `deg_injure=5, deg_miss=45, deg_graze=60, deg_normal=200, deg_crit=50`)
- `Materials` - 15 materials seeded
- `ItemTypes` - 27 item types (4 weapons: Enormous Key, Gatling Gun, Sword, Wooden Stick)

### Enemy Pools Content

**Universal Pools (3):**
- Level 1: Spray Paint Goblin, Goopy Floating Eye
- Level 5: Goopy Floating Eye, Feral Unicorn, Bipedal Deer
- Level 10: Feral Unicorn, Bipedal Deer, Politician

**Location-Specific Pools (8):**
- **Gym** (Levels 1-3, 4-7): Athletic theme - Feral Unicorn, Bipedal Deer weighted higher
- **Park** (Levels 1-3, 4-7): Nature theme - All animals weighted evenly
- **Coffee Shop** (Levels 1-3, 4-7): Quirky theme - Spray Paint Goblin, Goopy Floating Eye
- **Library** (Levels 1-3, 4-7): Intellectual theme - Politician, Goopy Floating Eye

### Loot Pools Content

**10 Universal Pools (Levels 1-10):**
- Level 1: Base weights (materials 50-100, items 30)
- Levels 2-9: Progressive weight increases (items become more common at higher levels)
- Level 10: Highest weights

**Materials:** Cactus, Feather, Gum, Coffee, Flame, Cloud, Sparkles, Slime, Matcha Powder, Bubble, Neon Sign, Rainbow, Ghost, Diamond

**Item Types:** Umbrella, Trash Can Lid, Leather Jacket, Sword, Bathrobe, Candle, Halo, and 20 more

### Weapon Dial Configuration

**MVP0 Universal Config (all weapons use this):**
- Pattern: `single_arc`
- Spin speed: 180 deg/s (0.5s per rotation)
- Default hit bands (before accuracy scaling):
  - Injure: 5° (1.4%) - Self-damage zone
  - Miss: 45° (12.5%) - No damage
  - Graze: 60° (16.7%) - 60% damage
  - Normal: 200° (55.6%) - 100% damage (largest zone)
  - Crit: 50° (13.9%) - 160% base + 0-100% RNG bonus

**Note:** Weapons table is empty. Backend should use default column values when no Weapons row exists for an item.

## ❌ Not Yet Implemented

### Backend Service Layer
- [ ] `CombatService` - Currently stub (mystica-express/src/services/CombatStubService.ts)
- [ ] Redis session management (15min TTL for active combat sessions)
- [ ] Weighted random pool selection logic
- [ ] Pool filter matching (location_type, universal, etc.)
- [ ] Enemy stat calculation from tiers (v_enemy_realized_stats view exists)
- [ ] Player stat aggregation from equipment (v_player_equipped_stats view may need implementation)
- [ ] Hit zone detection logic (tap_position_degrees → fn_weapon_bands_adjusted → determine zone)
- [ ] Damage calculation with zone multipliers
- [ ] Loot generation with weighted random selection
- [ ] Style inheritance (enemy style_id → material style_id)

### Frontend (SwiftUI)
- [ ] Combat UI screen
- [ ] Dial animation (single_arc pattern, 180 deg/s rotation)
- [ ] Color-coded hit zones rendering
- [ ] Tap gesture handling → calculate tap_position_degrees
- [ ] HP bar animations
- [ ] Haptic feedback (heavy on crit, light on normal)
- [ ] Victory/Defeat screens
- [ ] Loot display with style effects

## 🎯 Next Steps

### Phase 1: Backend Implementation (Priority)
1. Implement `CombatService` with Redis sessions
2. Add weighted random pool selection utilities
3. Implement enemy selection logic (combat level + location filter matching)
4. Implement loot drop logic (weighted random + style inheritance)
5. Add hit zone detection (fn_weapon_bands_adjusted integration)
6. Implement damage calculation with all multipliers
7. Write integration tests for combat flow

### Phase 2: Frontend Combat UI
1. Create CombatView.swift with dial animation
2. Implement tap detection and degree calculation
3. Integrate with backend API (POST /combat/start, /combat/attack, /combat/complete)
4. Add HP bars and damage number animations
5. Add haptic feedback system
6. Create victory/defeat result screens

### Phase 3: Testing & Refinement
1. Balance enemy stats across tiers
2. Balance loot pool weights
3. Tune weapon dial zone sizes for difficulty
4. Test location-specific pool variety
5. Validate style inheritance flow

## Implementation Notes

- **Weapons table FK constraint:** References Items (player-owned instances), not ItemTypes. For MVP0, backend falls back to Weapons table defaults when no row exists.
- **Pool selection logic:** Filter by combat_level (player avg item level) AND filter_type/filter_value (location_type='gym', etc.)
- **Style system:** Enemies with non-'normal' style_id MUST drop materials with matching style_id
- **Dial mechanics:** MVP0 uses constant 180 deg/s for ALL weapons, single_arc pattern only
- **Session TTL:** Combat sessions expire after 15 minutes in Redis (not persisted to PostgreSQL)
