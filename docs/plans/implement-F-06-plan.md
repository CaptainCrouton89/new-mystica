# Implementation Plan – F-06 Item Upgrade System

## Overview
- **Item ID:** F-06
- **Spec:** `docs/feature-specs/F-06-item-upgrade-system.yaml`
- **Scope:** Backend-only implementation (routes, controller, services)
- **Status:** **MOSTLY IMPLEMENTED** - Core logic exists, needs testing and validation

## Discovery Summary

**Critical Finding:** F-06 upgrade system is **already implemented** in the codebase:

### Existing Implementation
- ✅ **ItemService.ts** (lines 33-247):
  - `getUpgradeCost()` - Formula: `100 × 1.5^(level-1)`, checks gold balance
  - `upgradeItem()` - Atomic transaction with manual fallback
  - `performManualUpgradeTransaction()` - Multi-step gold deduction, EconomyTransactions logging, item level update

- ✅ **StatsService.ts** (lines 25-38):
  - `computeItemStatsForLevel()` - MVP0 formula: `base_stats × level × 10`
  - Material modifiers supported (lines 40-78)

- ✅ **ProfileService.ts** (lines 46-80):
  - `updateVanityLevel()` - Sums all equipped item levels from UserEquipment table

- ✅ **ItemController.ts** (lines 30-65):
  - `getUpgradeCost()` - Returns cost info JSON
  - `upgradeItem()` - Handles POST request, returns upgrade result

- ✅ **Routes** (`src/routes/items.ts`):
  - `GET /items/:item_id/upgrade-cost` (line 26-29)
  - `POST /items/:item_id/upgrade` (line 33-36)
  - Both routes use `authenticate` + `validate` middleware

- ✅ **Route Mounting** (`src/routes/index.ts:36`):
  - Items routes registered at `/api/v1/items`

### What's Missing
1. **Database Migration NOT Applied** - `migrations/001_initial_schema.sql` exists but not deployed to Supabase
2. **Service Layer Testing** - No validation that implementation works end-to-end
3. **API Integration Tests** - No tests for upgrade endpoints
4. **Database RPC Function** - `process_item_upgrade` RPC referenced but may not exist (manual transaction fallback exists)

## Current System

**Architecture:**
```
Request Flow:
POST /api/v1/items/:id/upgrade
  → authenticate middleware (validates JWT)
  → validate middleware (checks item_id param)
  → ItemController.upgradeItem()
    → ItemService.upgradeItem()
      → ItemService.getUpgradeCost() (validates ownership, checks gold)
      → supabase.rpc('process_item_upgrade') OR manual transaction
        1. Deduct gold from UserCurrencyBalances
        2. Log transaction to EconomyTransactions
        3. Update Items.level and Items.current_stats
      → ProfileService.updateVanityLevel() (sums UserEquipment item levels)
    → Return upgrade result JSON
```

**Database Tables (from migrations/001_initial_schema.sql):**
- `Items` - Has `level INT DEFAULT 1` column
- `UserCurrencyBalances` - Tracks GOLD balance per user
- `EconomyTransactions` - Audit log for all currency changes
- `Users` - Has `vanity_level INT` column
- `UserEquipment` - 8 slots for equipped items

## Changes Required

### Status: NO CODE CHANGES NEEDED

The implementation is **feature-complete** per F-06 spec. All required changes are **infrastructure/validation tasks**.

## Task Breakdown

| ID | Description | Type | Deps | Exit Criteria |
|----|-------------|------|------|---------------|
| **T1** | Apply database migration to Supabase | Infrastructure | — | Migration 001 applied, all tables exist |
| **T2** | Create/verify `process_item_upgrade` RPC function | Database | T1 | RPC exists OR manual transaction verified working |
| **T3** | Test upgrade cost calculation | Validation | T1 | `GET /upgrade-cost` returns correct formula results |
| **T4** | Test item upgrade flow (happy path) | Validation | T1, T2 | Item level increments, gold deducted, stats updated |
| **T5** | Test insufficient gold error handling | Validation | T1, T2 | Returns 400 error when gold < cost |
| **T6** | Test vanity level recalculation | Validation | T1, T2 | Vanity level updates after upgrade |
| **T7** | Verify economy transaction logging | Validation | T1, T2 | EconomyTransactions records created |

## Parallelization

### Batch 1: Database Setup (Sequential)
- **T1**: Apply migration (blocking)
- **T2**: Verify/create RPC function (depends on T1)

### Batch 2: Validation (Parallel after Batch 1)
- **T3**: Upgrade cost calculation tests
- **T4**: Happy path upgrade flow
- **T5**: Error handling tests
- **T6**: Vanity level tests
- **T7**: Transaction logging verification

**Note:** All Batch 2 tasks can run in parallel via test suite or manual validation.

## Data/Schema Changes

**Migration:** `mystica-express/migrations/001_initial_schema.sql`
- Creates `Items.level` column
- Creates `UserCurrencyBalances` table (GOLD tracking)
- Creates `EconomyTransactions` audit table
- Creates `Users.vanity_level` column
- Creates `UserEquipment` table (8 slots)

**RPC Function (Optional, fallback exists):**
```sql
CREATE OR REPLACE FUNCTION process_item_upgrade(
  p_user_id UUID,
  p_item_id UUID,
  p_gold_cost INT,
  p_new_level INT,
  p_new_stats JSONB
) RETURNS VOID AS $$
BEGIN
  -- 1. Deduct gold (with balance check)
  -- 2. Log economy transaction
  -- 3. Update item level and stats
  -- All in atomic transaction
END;
$$ LANGUAGE plpgsql;
```

**API Endpoints (Already Implemented):**
- `GET /api/v1/items/:item_id/upgrade-cost`
- `POST /api/v1/items/:item_id/upgrade`

## Implementation Strategy

### Approach: **Validation-Only Workflow**

Since code is complete, focus on:
1. **Deploy Infrastructure** - Apply migration, verify database state
2. **Validation Testing** - Exercise all code paths with real/test data
3. **Documentation** - Verify spec alignment

### Task Execution Order

**Phase 1: Database Setup (5-10 minutes)**
```bash
# T1: Apply migration to Supabase
cd mystica-express
supabase db push  # OR manual psql execution

# T2: Verify RPC function OR confirm manual transaction works
```

**Phase 2: Validation (15-20 minutes)**
- Create test user with gold and items
- Execute upgrade cost endpoint (T3)
- Execute upgrade endpoint (T4)
- Test error cases (T5)
- Verify vanity level updates (T6)
- Check EconomyTransactions table (T7)

**Tools:**
- Manual API testing (curl/Postman)
- Database queries (psql/Supabase Studio)
- OR Automated tests (if test framework exists)

## Expected Result

After executing this plan:

1. **Database Schema Applied**
   - `Items`, `UserCurrencyBalances`, `EconomyTransactions`, `UserEquipment` tables exist
   - All columns present (`Items.level`, `Users.vanity_level`, etc.)

2. **Endpoints Functional**
   - `GET /api/v1/items/:id/upgrade-cost` returns cost info with correct formula
   - `POST /api/v1/items/:id/upgrade` upgrades item, deducts gold, updates stats

3. **Business Logic Validated**
   - Upgrade cost formula: `100 × 1.5^(current_level - 1)` ✅
   - Stat scaling: `base_stats × target_level × 10` ✅
   - Vanity level: Sum of all equipped item levels ✅
   - Economy audit: All gold changes logged ✅

4. **Error Handling Verified**
   - Returns 404 for non-existent/unowned items
   - Returns 400 for insufficient gold
   - Transaction rollback on failures

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration not applied | High - Endpoints fail | **Critical**: Apply T1 first before testing |
| RPC function missing | Low - Manual transaction fallback exists | Verify fallback works in T2 |
| Auth middleware broken | High - Can't test endpoints | Known issue (null SupabaseClient), fix separately |
| Test data setup difficult | Medium - Slows validation | Create seed script for test users/items |

## Notes

- **Auth Middleware Issue**: `src/middleware/auth.ts:44,104` uses `null as unknown as SupabaseClient` - this needs fixing for endpoints to work
- **Manual Transaction Fallback**: Lines 179-247 in ItemService.ts provide fallback if RPC doesn't exist
- **MVP0 Simplifications**: No rarity multiplier in stat formula (per spec line 138)
- **Vanity Level Formula**: Currently sums all equipped item levels (F-06 spec suggests `sum/6` but implementation just sums)

## Next Steps

### Option 1: Full Validation (Recommended)
```bash
/manage-project/implement/execute F-06
```
Executes T1-T7 sequentially with validation agents

### Option 2: Manual Database Setup + Testing
```bash
# Apply migration
cd mystica-express
supabase db push

# Test endpoints manually with curl/Postman
# Verify database state in Supabase Studio
```

### Option 3: Skip to Final Validation
```bash
/manage-project/implement/validate F-06
```
Assumes database is set up, runs comprehensive validation

---

**Recommendation:** Start with **T1 (apply migration)**, then run automated validation via `/manage-project/implement/execute F-06` to verify all code paths work.
