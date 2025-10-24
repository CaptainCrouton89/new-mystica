# Combat Reward System Investigation

## Problem Summary

Materials and items are not persisting to the player's inventory after combat victory. The backend generates rewards but fails to store them in the database.

---

## Root Causes Identified

### 1. **Duplicate & Conflicting Reward Persistence Logic**

**Issue:** Two separate reward persistence flows exist with inconsistent approaches:

#### Flow 1: `completeCombatInternal()` (CombatService.ts:668-711)
```typescript
// Lines 668-711
for (const material of baseRewards.materials) {
  await materialRepository.createStack(
    session.userId,
    material.material_id,
    material.style_id,
    1 // 1 of each material
  );
}

for (const item of baseRewards.items) {
  await itemRepository.create({
    user_id: session.userId,
    item_type_id: item.item_type_id,
    level: session.combatLevel,
  });
}
```

**Problem:** Uses `createStack()` which fails if stack already exists (not upsert).

#### Flow 2: `applyRewardsTransaction()` (CombatService.ts:936-1025)
```typescript
// Lines 964-994
for (const material of rewards.materials) {
  await this.materialRepository.incrementStack(
    userId,
    material.material_id,
    material.style_id,
    1 // Always 1 unit per material drop
  );
}

for (const item of rewards.items) {
  await this.itemRepository.create({
    user_id: userId,
    item_type_id: item.item_type_id,
    level: 1, // Items drop at level 1 (hardcoded)
  });
}
```

**Problem:** Uses `incrementStack()` (correct upsert) but gets called AFTER `completeCombatInternal()` has already attempted persistence.

### 2. **Rewards Applied Twice with Different Logic**

**Location:** executeAttack() (lines 444-451) and executeDefense() (lines 583-591)

Both methods call:
```typescript
rewards = await this.completeCombatInternal(sessionId, combatStatus, session);
await this.applyRewardsTransaction(session.userId, sessionId, rewards);
```

**Timeline:**
1. **completeCombatInternal()** runs first → attempts to persist with `createStack()` → **FAILS if any duplicate**
2. Function catches error silently with try-catch (lines 669-687, 692-710)
3. **applyRewardsTransaction()** runs next → attempts to persist with `incrementStack()` → **Might succeed but rewards already "handled"**

**The Problem:** If step 1 fails, rewards object is still returned to applyRewardsTransaction which doesn't know about the failure.

### 3. **Session Cleanup Timing Issue**

**Location:** applyRewardsTransaction() line 1012

```typescript
await this.combatRepository.deleteSession(sessionId);
```

Session is deleted AFTER attempting reward persistence. If persistence fails mid-transaction, the session is still deleted, making retry impossible.

### 4. **Inconsistent Item Level Assignment**

**Flow 1:** Uses `session.combatLevel`
```typescript
level: session.combatLevel,  // Line 696
```

**Flow 2:** Uses hardcoded `1`
```typescript
level: 1, // Items drop at level 1 (Line 983)
```

This inconsistency suggests the flows were never meant to coexist.

### 5. **TypeScript Compilation Errors Blocking Testing**

#### Error Set 1: LocationRepository.ts (lines 322, 325)
```
Property 'material_name' does not exist on type 'LootDrop'.
Property 'item_type_name' does not exist on type 'LootDrop'.
```

**Cause:** Code tries to assign non-existent properties:
```typescript
// LocationRepository.ts:322-325
drop.material_name = entry.lootable_name;  // ❌ material_name not in LootDrop interface
drop.item_type_name = entry.lootable_name;  // ❌ item_type_name not in LootDrop interface
```

**LootDrop interface definition** (repository.types.ts:368-375):
```typescript
export interface LootDrop {
  type: 'material' | 'item' | 'gold';
  material_id?: string;
  item_type_id?: string;
  gold_amount?: number;
  style_id?: string;
  quantity?: number;
  // Missing: material_name, item_type_name
}
```

#### Error Set 2: CombatService.test.ts (lines 560-564, 571, 579-581)
```
Property 'rewards' does not exist on type 'CombatRewards'.
```

**Expected by test:**
```typescript
// Line 560-564
expect(result.rewards).toBeDefined();
expectValidGoldAmount(result.rewards!.currencies.gold);
expect(result.rewards!.experience).toBeGreaterThan(0);
expect(result.rewards!.combat_history).toBeDefined();
expect(result.rewards!.combat_history.victories).toBeGreaterThan(0);
```

**Actual CombatRewards interface** (CombatService.ts:120-171):
```typescript
export interface CombatRewards {
  result: 'victory' | 'defeat';
  currencies?: {...};
  materials?: Array<...>;
  items?: Array<...>;
  experience?: number;
  combat_history: {...};
  // ❌ No 'rewards' wrapper property
}
```

The test expects `result.rewards.combat_history` but the interface has `result.combat_history` directly.

---

## Data Flow Analysis

### Current (Broken) Flow:
```
executeAttack/executeDefense
  ↓
completeCombatInternal()
  ├─ generateLoot() → returns baseRewards
  ├─ Try to persist materials with createStack() → ⚠️ FAILS if duplicate
  ├─ Try to persist items with itemRepository.create() → ⚠️ Might fail
  └─ Return rewards object (with errors silently caught)
  ↓
applyRewardsTransaction()
  ├─ Try to persist materials with incrementStack() → Might succeed
  ├─ Try to persist items with itemRepository.create() → Duplicate create attempt
  ├─ Add currencies to profile
  └─ Delete session (⚠️ SUCCESS PATH EVEN IF PERSISTENCE FAILED)
```

### Actual Outcomes:
- **Best case:** Both attempts fail silently, no persistence, but response shows rewards as if applied
- **Worst case:** applyRewardsTransaction deletes session while completeCombatInternal is still retrying

---

## Method Behavior Reference

### MaterialRepository.createStack() (lines 249-296)
- **Behavior:** Inserts new stack, fails if composite key (user_id, material_id, style_id) already exists
- **Return:** Created MaterialStackRow
- **Error:** Throws if insert fails (no duplicate handling)

### MaterialRepository.incrementStack() (lines 203-217)
- **Behavior:** Upsert - creates if missing, increments if exists
- **Return:** Updated MaterialStackRow
- **Error:** Throws if not found (for decrement only)
- **Used by:** applyRewardsTransaction (correct)

---

## Test Infrastructure Expectations

### Tests check for:
1. `result.rewards` property (doesn't exist)
2. `result.rewards.currencies.gold` (should be `result.currencies.gold`)
3. `result.rewards.experience` (should be `result.experience`)
4. `result.rewards.combat_history` (should be `result.combat_history`)

### Test file: tests/unit/services/CombatService.test.ts

- **Line 560:** `expect(result.rewards).toBeDefined();`
- **Line 561:** `expectValidGoldAmount(result.rewards!.currencies.gold);`
- **Line 562:** `expect(result.rewards!.experience).toBeGreaterThan(0);`
- **Line 563:** `expect(result.rewards!.combat_history).toBeDefined();`
- **Line 564:** `expect(result.rewards!.combat_history.victories).toBeGreaterThan(0);`

Tests are expecting a different response structure than what CombatRewards actually provides.

---

## Files That Need Fixes

### 1. src/services/CombatService.ts
- **Lines 639-731:** Remove duplicate persistence in `completeCombatInternal()`
- **Lines 936-1025:** Keep `applyRewardsTransaction()` but verify it handles failures
- **Lines 444-451, 583-591:** Remove redundant calls to `applyRewardsTransaction()`

### 2. src/repositories/LocationRepository.ts
- **Lines 322, 325:** Remove invalid property assignments or update LootDrop interface

### 3. src/types/repository.types.ts
- **Lines 368-375:** Add `material_name` and `item_type_name` optional properties to LootDrop interface

### 4. tests/unit/services/CombatService.test.ts
- **Lines 560-564:** Update test expectations to match actual CombatRewards interface
- **Lines 571, 579-581:** Fix all `result.rewards.*` references to `result.*`

---

## Summary of Issues

| Issue | Severity | Impact | Location |
|-------|----------|--------|----------|
| Duplicate persistence logic | **CRITICAL** | Rewards fail to persist | CombatService.ts:639-1025 |
| createStack() fails on duplicate | **CRITICAL** | Blocks all reward persistence | MaterialRepository.ts:249-296 |
| Session deleted before persistence verified | **HIGH** | Prevents retry if transaction fails | CombatService.ts:1012 |
| Invalid LootDrop properties | **HIGH** | Blocks compilation | LocationRepository.ts:322-325 |
| Wrong LootDrop interface | **HIGH** | Compilation error | repository.types.ts:368-375 |
| Test expects wrong structure | **MEDIUM** | Tests can't pass regardless | CombatService.test.ts:560-581 |
| Inconsistent item level assignment | **MEDIUM** | Logic disagreement between flows | CombatService.ts:696 vs 983 |

---

## Recommended Fix Strategy

1. **Remove completeCombatInternal persistence logic** - Use only applyRewardsTransaction
2. **Use incrementStack instead of createStack** - Upsert pattern is correct
3. **Move session deletion to transaction success check** - Ensure atomic operation
4. **Fix LootDrop interface** - Add missing properties or refactor usage
5. **Update tests** - Match actual CombatRewards structure
6. **Verify error handling** - All repository operations should fail loudly (throw), not silently
