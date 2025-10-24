# Combat Reward Persistence Investigation

## Problem Statement
After victory in combat, only **gold** is awarded to the player. **Materials and items** generated from loot pools are **never persisted** to the player's inventory.

---

## Current Data Flow Trace

### 1. Combat Victory Detection
**Location:** `CombatService.ts:executeAttack()` / `executeDefense()`
**Lines:** 444-451 (attack), 583-591 (defense)

```typescript
// When enemy HP drops to 0
if (enemyHP <= 0) {
  logger.debug('⚔️ Combat victory', { sessionId, playerHP, enemyHP: 0 });
  const rewards = await this.completeCombatInternal(sessionId, 'victory', session);
  return { combat_status: 'victory', rewards };
}
```

**Log Evidence:**
```
23:37:56 [[34mdebug[39m]: [34m⚔️ Combat victory[39m
{
  "sessionId": "07b3afda-70a5-4439-9dcd-50a297435c6d",
  "playerHP": 27,
  "enemyHP": 0
}
```

---

### 2. Loot Generation
**Location:** `CombatService.ts:completeCombatInternal()` → `generateLoot()`
**Lines:** 665, 1303-1349

The victory triggers `generateLoot()` which:
1. Fetches enemy style ID
2. Queries loot pools matching location + combat level
3. Calls `generateLootFallback()` which:
   - Gets loot pool entries
   - Selects random materials/items via `locationService.selectRandomLoot()`
   - Batch fetches ItemType details
   - Returns structured rewards object

**Generated Loot Structure:**
```typescript
{
  currencies: { gold: 10-40 },
  materials: [
    {
      material_id: "uuid-1",
      name: "Iron",
      style_id: "normal",
      style_name: "Normal"
    }
  ],
  items: [
    {
      item_type_id: "uuid-2",
      name: "Rusty Sword",
      category: "weapon",
      rarity: "common",
      style_id: "normal",
      style_name: "Normal"
    }
  ],
  experience: 15
}
```

**Log Evidence from Loot Generation:**
```
23:38:12 [[32minfo[39m]: [32m💰 Loot generation summary[39m
{
  "locationId": "66b6a41f-e8f9-464b-ba0d-5634dc5485bf",
  "combatLevel": 1,
  "lootPoolsMatched": 2,
  "totalDropsGenerated": 3,
  "materialDrops": 1,
  "itemDropsSelected": 2,
  "itemsAfterFiltering": 2,
  "goldAmount": 25
}
```

---

### 3. The Break: Reward Persistence Attempt
**Location:** `CombatService.ts:completeCombatInternal()` lines 668-711 (CURRENT IMPLEMENTATION)

**Currently Attempted but BROKEN:**
```typescript
// Persist materials to player's inventory
for (const material of baseRewards.materials) {
  try {
    await materialRepository.createStack(
      session.userId,
      material.material_id,
      material.style_id,
      1 // 1 of each material
    );
    logger.info('✅ Material awarded', { ... });
  } catch (error) {
    logger.warn('Failed to award material', { ... });
  }
}

// Persist items to player's inventory
for (const item of baseRewards.items) {
  try {
    await itemRepository.create({
      user_id: session.userId,
      item_type_id: item.item_type_id,
      level: session.combatLevel,
    });
    logger.info('✅ Item awarded', { ... });
  } catch (error) {
    logger.warn('Failed to award item', { ... });
  }
}
```

**Problem:** These log messages `✅ Material awarded` and `✅ Item awarded` **NEVER APPEAR IN LOGS**—meaning this code path is not being executed, or was added after the real persistence flow.

---

### 4. Alternative Persistence Flow (ACTUAL IMPLEMENTATION)
**Location:** `CombatService.ts:applyRewardsTransaction()`
**Lines:** 936-1025

There is a SECOND, separate rewards persistence method that is called from `executeAttack()` and `executeDefense()`:

```typescript
// From executeAttack() line 444-451
const rewards = await this.completeCombatInternal(sessionId, 'victory', session);

// Then immediately after (same control flow):
await this.applyRewardsTransaction(
  sessionId,
  session.userId,
  combatStatus,
  sessionSnapshot.rewards // DIFFERENT rewards object
);
```

**This second method:**
- Uses `materialRepository.incrementStack()` (upsert pattern, not create)
- Calls `itemRepository.create()` differently
- Handles gold separately
- Has its own error handling and logging

**The Problem:**
- Two completely independent reward persistence flows
- `completeCombatInternal()` generates rewards BUT doesn't actually persist them properly
- `applyRewardsTransaction()` may be the "real" one, but it's using a different rewards source
- No coordination between the two = race conditions and data loss

---

## Why Materials/Items Don't Appear

### The Smoking Gun: Missing Persistence Logging

**What we see in logs after victory:**
```
23:38:12 [[32minfo[39m]: [32m💰 Loot generation summary[39m
{ "totalDropsGenerated": 3, "materialDrops": 1, "itemsAfterFiltering": 2 }
```

**What we DON'T see:**
```
✅ Material awarded  <-- NEVER LOGGED
✅ Item awarded      <-- NEVER LOGGED
```

**What we DO see for gold:**
Gold updates are handled elsewhere (not in the above code paths visible in logs)

### Hypothesis: Rewards Generated But Never Persisted
1. ✅ `generateLoot()` creates material/item objects correctly
2. ✅ Rewards object is returned to frontend
3. ❌ Materials NOT inserted into `MaterialStacks` table
4. ❌ Items NOT inserted into `PlayerItems` table
5. ✅ Gold may be updated (need to check currency service)

---

## Type & Compilation Issues Blocking Fixes

### Issue 1: LootDrop Type Mismatch
**File:** `src/repositories/LocationRepository.ts` lines 322, 325
**Error:** TS2339 Property 'material_name' does not exist on type 'LootDrop'

Code tries to assign:
```typescript
drop.material_name = entry.lootable_name;  // Line 322
drop.item_type_name = entry.lootable_name; // Line 325
```

But `LootDrop` interface only has:
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

### Issue 2: Test Structure Mismatch
**File:** `tests/unit/services/CombatService.test.ts` lines 560-581
**Error:** TS2339 Property 'rewards' does not exist on type 'CombatRewards'

Tests expect:
```typescript
expect(result.rewards.currencies.gold).toBe(25);
```

But `CombatRewards` interface has:
```typescript
export interface CombatRewards {
  result: 'victory' | 'defeat';
  currencies?: { gold: number };  // Direct, not nested under .rewards
  materials?: Array<{ ... }>;
  items?: Array<{ ... }>;
  experience?: number;
  combat_history: { ... };
}
```

Correct assertion should be:
```typescript
expect(result.currencies.gold).toBe(25);
```

---

## Actual Database State After Victory

**What should happen:**
1. New row in `MaterialStacks` (user_id, material_id, style_id, quantity=1)
2. New row in `PlayerItems` (user_id, item_type_id, level=1, ...)
3. Currency balance updated (gold +25)
4. Combat session deleted or marked complete

**What actually happens:**
1. ❌ MaterialStacks: **NO NEW ROWS** (materials disappear)
2. ❌ PlayerItems: **NO NEW ROWS** (items disappear)
3. ? Currency: **Unknown** (need to check gold flow)
4. ✅ Combat session: Deleted or marked complete

---

## Root Cause Summary

| Issue | Location | Evidence | Impact |
|-------|----------|----------|--------|
| **Dual persistence flows** | executeAttack/executeDefense → completeCombatInternal + applyRewardsTransaction | Two methods called sequentially with different implementations | Race conditions, materials/items lost |
| **No persistence in completeCombatInternal** | CombatService.ts:668-711 | Zero `✅ Material awarded` logs ever appear | Materials never reach database |
| **Type mismatch in LootDrop** | LocationRepository.ts:322,325 | TS2339 compile error | Prevents build |
| **Test assertion errors** | CombatService.test.ts:560-581 | 8 assertions with wrong property path | Tests can't validate rewards |
| **Session cleanup timing** | CombatService.ts:1012 | Session deleted after (not before) persistence attempts | Non-atomic, unrecoverable if persistence fails |

---

## Recommended Fixes (In Order)

### 1. Fix LootDrop Type (UNBLOCKS BUILD)
Add missing properties to interface:
```typescript
export interface LootDrop {
  type: 'material' | 'item' | 'gold';
  material_id?: string;
  material_name?: string;        // ADD THIS
  item_type_id?: string;
  item_type_name?: string;       // ADD THIS
  gold_amount?: number;
  style_id?: string;
  quantity?: number;
}
```

### 2. Fix Test Assertions (UNBLOCKS TESTS)
Change all `result.rewards.*` → `result.*`:
```typescript
// BEFORE
expect(result.rewards.currencies.gold).toBe(25);

// AFTER
expect(result.currencies.gold).toBe(25);
```

### 3. Consolidate Reward Persistence (FIXES REWARDS)
Remove the broken persistence in `completeCombatInternal()` lines 668-711.
Ensure `applyRewardsTransaction()` is the ONLY persistence path.
Use `incrementStack()` for materials (upsert pattern).

### 4. Fix Atomicity
Keep session alive until ALL rewards confirmed in database.
Consider using Supabase RPC transaction if available.

### 5. Verify Currency Flow
Check if gold is being updated in a separate flow or if it's also broken.
Add logging to confirm gold persistence.
