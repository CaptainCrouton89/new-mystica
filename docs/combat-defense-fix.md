# Combat Defense Mechanics - Problem & Solution

## Current Problems

### 1. Player Defense Zone Semantics Bug
**Location:** `mystica-express/src/services/combat/turn-execution.ts:136-181` (`executeDefenseTurn`)

**Issue:** Defense effectiveness calculation uses attack-oriented zone multipliers incorrectly:
```typescript
// Current (BROKEN):
const playerDefenseEffectiveness = statsService.applyZoneModifiers(1, playerDefenseZone, 1.0);
const damageBlocked = Math.floor(enemyDamage * (1 - playerDefenseEffectiveness));

// Zone 1 → 1.5 effectiveness → blocks 1 - 1.5 = -0.5 (negative?!)
// Zone 5 → 0.5 effectiveness → blocks 1 - 0.5 = 0.5 (50% blocked)
```

**Result:** Zone semantics are inverted or broken. Zone 5 (worst) blocks more than intended.

**Constants Reference:**
```typescript
// From combat/constants.ts
ZONE_MULTIPLIERS = { 1: 1.5, 2: 1.25, 3: 1.0, 4: 0.75, 5: 0.5 }
HIT_BAND_TO_ZONE = { 'crit': 1, 'normal': 2, 'graze': 3, 'miss': 4, 'injure': 5 }
```

### 2. Missing Enemy Defense Mechanics
**Location:** `mystica-express/src/services/combat/turn-execution.ts:87-134` (`executeAttackTurn`)

**Issue:** When player attacks, enemy damage calculation is:
```typescript
newEnemyHP = Math.max(0, currentEnemyHP - damageDealt);
```

- No zone-based blocking
- Enemy `def_accuracy_normalized` stat exists but is unused
- Creates asymmetry - only player has zone-based defense

### 3. Attack Zone 5 (Injure) Behavior (Working Correctly)
**Location:** `executeAttackTurn` lines 107-115

**Current Behavior (KEEP THIS):**
```typescript
if (hitZone === 'injure') {
  // Player attacks zone 5 = catastrophic failure
  newPlayerHP = Math.max(0, currentPlayerHP - damageDealt - enemyDamage);  // DOUBLE damage
  newEnemyHP = currentEnemyHP;  // Enemy takes NO damage
}
```

This is correct - zone 5 attack should hurt the attacker.

## Desired Outcomes

### Goal: Symmetrical Zone-Based Defense for Player + Enemy

**Defense Zone Effectiveness (Same for Player & Enemy):**
- Zone 1 (crit defense) → Best blocking (~95-100% of damage blocked)
- Zone 2 (normal defense) → Strong blocking (~80-95% blocked)
- Zone 3 (graze defense) → Moderate blocking (~60-80% blocked)
- Zone 4 (miss defense) → Weak blocking (~40-60% blocked)
- Zone 5 (injure defense) → Worst blocking (~20-40% blocked) + possible extra penalty

**Implementation Requirements:**

1. **Shared Defense Logic**
   - Create `calculateDefenseBlocking(damage, defenseZone)` function
   - Both player and enemy use identical logic
   - Zone multipliers interpreted as blocking percentage (capped appropriately)

2. **Player Defense Fix**
   - Replace broken formula in `executeDefenseTurn`
   - Zone 1 = maximum blocking, Zone 5 = minimum blocking
   - Maintain MIN_DAMAGE constraint

3. **Enemy Defense Addition**
   - In `executeAttackTurn`, simulate enemy defense zone using `simulateEnemyZoneHit(def_accuracy_normalized)`
   - Apply blocking calculation before reducing enemy HP
   - Return enemy defense info in `AttackResult` type

4. **Zone 5 Special Penalty (Optional)**
   - For catastrophic defense failure (zone 5), consider adding extra damage penalty
   - Mirrors attack zone 5 self-damage mechanic

## Success Criteria

✅ Zone 1 defense blocks maximum damage for both player and enemy
✅ Zone 5 defense blocks minimum damage for both player and enemy
✅ Player and enemy use identical `calculateDefenseBlocking()` logic
✅ Enemy `def_accuracy_normalized` stat is utilized for defense zone simulation
✅ Attack zone 5 penalty unchanged (still damages attacker)
✅ All existing combat tests pass
✅ New tests validate symmetric defense mechanics

## Files to Modify

1. `mystica-express/src/services/combat/turn-execution.ts`
   - Add `calculateDefenseBlocking()` helper function
   - Fix `executeDefenseTurn()` player defense calculation
   - Add enemy defense to `executeAttackTurn()`

2. `mystica-express/src/services/combat/types.ts`
   - Add enemy defense info fields to `AttackResult` interface

3. Tests (create/update as needed)
   - Validate zone 1-5 defense blocking percentages
   - Verify player/enemy symmetry
   - Edge cases (MIN_DAMAGE, zone 5 penalty)
