# F-06 Item Upgrade System - Backend Investigation Report

## Executive Summary

Investigation reveals that **upgrade endpoints already exist but are not implemented**. The ItemController has `getUpgradeCost` and `upgradeItem` methods, routes are defined, but all service methods throw `NotImplementedError`. The architecture is well-designed and ready for implementation.

## Key Findings

### 1. Existing Implementation Status

**✅ Already Implemented:**
- ItemController upgrade methods (`getUpgradeCost`, `upgradeItem`)
- Route definitions (`GET /items/:item_id/upgrade-cost`, `POST /items/:item_id/upgrade`)
- Zod validation schemas (`ItemIdParamsSchema`)
- Auth middleware integration
- Response type definitions

**❌ Missing Implementation:**
- Service layer methods (all throw `NotImplementedError`)
- Actual upgrade logic
- Cost calculation formula
- Stat recalculation
- Gold deduction

### 2. Service Layer Architecture

**Service Pattern:**
```typescript
export class ServiceName {
  async methodName(userId: string, ...params): Promise<ReturnType> {
    // TODO: Implementation steps in comments
    throw new NotImplementedError('methodName not implemented');
  }
}
```

**Required Service Methods:**
- `ItemService.getUpgradeCost(userId, itemId)` → `{ canAfford, cost, currentLevel }`
- `ItemService.upgradeItem(userId, itemId)` → `UpgradeResult`
- `StatsService.computeItemStats(item, targetLevel)` → `Stats`
- `ProfileService.updateVanityLevel(userId)` → `void`

### 3. Database Schema Analysis

**Critical Tables:**
- `Items`: `level` (INT ≥ 1), `current_stats` (JSON)
- `UserCurrencyBalances`: Active currency system (`GOLD`, `GEMS`)
- `EconomyTransactions`: Audit trail with `source_id` for item references
- `Users`: `vanity_level` (INT ≥ 0), no auto-triggers

**Key Operations:**
1. Atomic transaction: currency deduction + level increment + audit logging
2. Stat recalculation using `base_stats × level × 10` formula
3. Vanity level update using `AVG(level)` across user's items

### 4. Implementation Requirements

**Upgrade Cost Formula:**
```typescript
cost = 100 * Math.pow(1.5, level - 1)
```

**Stat Scaling:**
```typescript
final_stats = base_stats × target_level × 10  // Simplified for MVP0
```

**Error Handling:**
- `BusinessLogicError` for insufficient gold
- `NotFoundError` for missing/unowned items
- Transaction rollback on failures

## Implementation Plan Preview

### Phase 1: Service Implementation (T1-T4)
1. **T1:** Implement `ItemService.getUpgradeCost()` with formula
2. **T2:** Implement `StatsService.computeItemStats()` with scaling
3. **T3:** Implement `ItemService.upgradeItem()` with transactions
4. **T4:** Implement `ProfileService.updateVanityLevel()` calculation

### Phase 2: Integration & Testing (T5-T6)
5. **T5:** End-to-end testing with Supabase integration
6. **T6:** Error handling validation (insufficient gold, etc.)

## Critical Notes

- **Auth middleware works:** Uses Supabase JWT validation, attaches `req.user`
- **Migration NOT applied:** Schema exists but not in Supabase yet
- **Currency system ready:** `UserCurrencyBalances` table properly designed
- **No breaking changes needed:** All infrastructure exists, just need implementations

## Files Investigated

**Service Layer:**
- `src/services/ItemService.ts` - Upgrade method skeletons
- `src/services/StatsService.ts` - Stat calculation patterns
- `src/services/ProfileService.ts` - User profile management

**Controller/Routes:**
- `src/controllers/ItemController.ts` - Upgrade endpoints implemented
- `src/routes/items.ts` - Route definitions complete

**Database:**
- `migrations/001_initial_schema.sql` - Complete schema analysis

**Infrastructure:**
- `src/middleware/auth.ts` - JWT validation working
- `src/types/schemas.ts` - Zod validation ready
- `src/utils/errors.ts` - Error handling hierarchy

## Recommendation

**Skip planning phase** - architecture is complete. Proceed directly to implementation with backend-developer agent focusing on the 4 core service methods. All patterns, types, and infrastructure are ready for immediate implementation.