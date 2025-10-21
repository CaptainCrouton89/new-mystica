# EconomyController Specification

## Controller Overview

**Purpose**: Centralized currency management and player performance tracking for New Mystica. Handles all currency operations (GOLD/GEMS), balance queries, affordability checks, and combat history analytics.

**Feature References**:
- **F-12 Enemy AI - Combat History**: Player performance tracking per location for AI context generation
- **F-06 Item Upgrades**: Currency deduction for upgrade costs
- **F-05 Material Replacement**: Currency validation and deduction for material swapping

**Service Dependencies**:
- `EconomyService` - Core currency operations with atomic transaction logging
- `AnalyticsService` - Combat history tracking and performance metrics (future)

**Location**: `mystica-express/src/controllers/EconomyController.ts`

---

## Endpoints

### 1. GET /economy/balances
**Purpose**: Get all currency balances for authenticated user

**Route Handler**: `getAllBalances`

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**: None
- **Query**: None
- **Body**: None

**Output Schema**:
```typescript
{
  success: true,
  balances: {
    GOLD: number,
    GEMS: number
  }
}
```

**Error Responses**:

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database connection failure"
  }
}
```

**Service Calls**:
- `economyService.getAllBalances(userId: string): Promise<CurrencyBalances>`

**Middleware Chain**: `auth → getAllBalances`

**Business Logic**:
1. Extract user ID from `req.user` (set by auth middleware)
2. Call EconomyService to fetch all balances
3. Return both GOLD and GEMS balances (defaults to 0 if no records)

**Implementation Status**: ✅ Complete (lines 15-28)

---

### 2. GET /economy/balance/:currency
**Purpose**: Get specific currency balance for authenticated user

**Route Handler**: `getCurrencyBalance`

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**:
  ```typescript
  {
    currency: 'GOLD' | 'GEMS'  // Case-insensitive, normalized to uppercase
  }
  ```
- **Query**: None
- **Body**: None

**Output Schema**:
```typescript
{
  success: true,
  currency: 'GOLD' | 'GEMS',
  balance: number
}
```

**Error Responses**:
**400 Bad Request:**
```typescript
{
  error: {
    code: "INVALID_CURRENCY",
    message: "Currency must be GOLD or GEMS"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database connection failure"
  }
}
```

**Service Calls**:
- `economyService.getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number>`

**Middleware Chain**: `auth → getCurrencyBalance`

**Business Logic**:
1. Extract user ID from `req.user`
2. Normalize currency parameter to uppercase
3. Validate currency is either 'GOLD' or 'GEMS'
4. Call EconomyService for specific balance
5. Return balance (defaults to 0 if no record exists)

**Implementation Status**: ✅ Complete (lines 34-60)

---

### 3. POST /economy/affordability
**Purpose**: Check if user can afford a purchase without modifying balance

**Route Handler**: `checkAffordability`

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**: None
- **Query**: None
- **Body**: `AffordabilityCheckRequest` (Zod schema: `AffordabilityCheckSchema`)
  ```typescript
  {
    currency: 'GOLD' | 'GEMS',
    amount: number  // Must be positive integer
  }
  ```

**Output Schema**:
```typescript
{
  success: true,
  affordability: {
    canAfford: boolean,
    currentBalance: number,
    requiredAmount: number,
    shortfall: number  // 0 if can afford, otherwise amount - balance
  }
}
```

**Error Responses**:
**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request body"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database connection failure"
  }
}
```

**Service Calls**:
- `economyService.getAffordabilityCheck(userId: string, currency: 'GOLD' | 'GEMS', amount: number): Promise<AffordabilityResult>`

**Middleware Chain**: `auth → validate(AffordabilityCheckSchema) → checkAffordability`

**Business Logic**:
1. Extract user ID from `req.user`
2. Extract validated request data from `req.validated.body`
3. Call EconomyService for detailed affordability analysis
4. Return complete affordability breakdown including shortfall calculation

**Related**: Used by F-06 (Item Upgrades) and F-05 (Material Replacement) before deducting costs

**Implementation Status**: ✅ Complete (lines 67-81)

---

### 4. POST /economy/add
**Purpose**: Add currency to user balance with transaction logging (admin/debug endpoint)

**Route Handler**: `addCurrency`

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**: None
- **Query**: None
- **Body**: `AddCurrencyRequest` (Zod schema: `AddCurrencySchema`)
  ```typescript
  {
    currency: 'GOLD' | 'GEMS',
    amount: number,  // Must be positive integer
    sourceType: string,  // Valid: combat_victory, daily_quest, achievement, iap, admin, profile_init
    sourceId?: string,   // Optional reference ID
    metadata?: Record<string, unknown>  // Optional metadata object
  }
  ```

**Output Schema**:
```typescript
{
  success: true,
  transaction: {
    success: boolean,
    previousBalance: number,
    newBalance: number,
    transactionId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number
  }
}
```

**Error Responses**:
**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request body or sourceType"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database operation failure"
  }
}
```

**Service Calls**:
- `economyService.addCurrency(userId, currency, amount, sourceType, sourceId?, metadata?): Promise<CurrencyOperationResult>`

**Middleware Chain**: `auth → validate(AddCurrencySchema) → addCurrency`

**Business Logic**:
1. Extract user ID from `req.user`
2. Extract validated request data from `req.validated.body`
3. Call EconomyService for atomic currency addition with transaction logging
4. Return transaction details including previous/new balances

**Related**: Used by combat victory rewards, quest completions, IAP processing

**Implementation Status**: ✅ Complete (lines 88-109)

---

### 5. POST /economy/deduct
**Purpose**: Deduct currency from user balance with validation and transaction logging

**Route Handler**: `deductCurrency`

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**: None
- **Query**: None
- **Body**: `DeductCurrencyRequest` (Zod schema: `DeductCurrencySchema`)
  ```typescript
  {
    currency: 'GOLD' | 'GEMS',
    amount: number,  // Must be positive integer
    sourceType: string,  // Valid: item_upgrade, material_replacement, shop_purchase, loadout_slot_unlock
    sourceId?: string,   // Optional reference ID
    metadata?: Record<string, unknown>  // Optional metadata object
  }
  ```

**Output Schema**:
```typescript
{
  success: true,
  transaction: {
    success: boolean,
    previousBalance: number,
    newBalance: number,
    transactionId: string,
    currency: 'GOLD' | 'GEMS',
    amount: number  // Negative value indicating deduction
  }
}
```

**Error Responses**:
**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid request body or sourceType"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**402 Payment Required:**
```typescript
{
  error: {
    code: "INSUFFICIENT_FUNDS",
    message: "Not enough GOLD. Required: 150, Available: 75"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database operation failure"
  }
}
```

**Service Calls**:
- `economyService.deductCurrency(userId, currency, amount, sourceType, sourceId?, metadata?): Promise<CurrencyOperationResult>`

**Middleware Chain**: `auth → validate(DeductCurrencySchema) → deductCurrency`

**Business Logic**:
1. Extract user ID from `req.user`
2. Extract validated request data from `req.validated.body`
3. Call EconomyService for atomic currency deduction with balance validation
4. EconomyService throws `InsufficientFundsError` if balance insufficient
5. Return transaction details with negative amount indicating deduction

**Related**: Core to F-06 (Item Upgrades) and F-05 (Material Replacement) purchase flows

**Implementation Status**: ✅ Complete (lines 116-137)

---

### 6. GET /players/combat-history/:location_id
**Purpose**: Get player's combat history at specific location for F-12 Enemy AI context

**Route Handler**: `getCombatHistory` (⚠️ **NOT YET IMPLEMENTED**)

**Input Schema**:
- **Headers**: Bearer Authorization (JWT token)
- **Params**: `LocationIdParamsSchema`
  ```typescript
  {
    location_id: string  // UUID format
  }
  ```
- **Query**: None
- **Body**: None

**Output Schema** (per API contracts line 1912):
```typescript
{
  success: true,
  history: {
    location_id: string,
    total_attempts: number,
    victories: number,
    defeats: number,
    win_rate: number,      // calculated: victories / total_attempts
    current_streak: number,
    longest_streak: number,
    last_attempt: string   // ISO timestamp
  }
}
```

**Error Responses**:
**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid location_id UUID format"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid or missing JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "LOCATION_NOT_FOUND",
    message: "Location doesn't exist"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database connection failure"
  }
}
```

**Service Calls** (⚠️ **NEEDS IMPLEMENTATION**):
- `economyService.getCombatHistory(userId: string, locationId: string): Promise<PlayerCombatHistory>`

**Middleware Chain**: `auth → validate(LocationIdParamsSchema) → getCombatHistory`

**Business Logic**:
1. Extract user ID from `req.user`
2. Extract and validate location_id from `req.params`
3. Call EconomyService to fetch combat history for this user/location
4. Calculate win_rate as `victories / total_attempts` (handle division by zero)
5. Return complete combat performance metrics

**Related Documentation**:
- **F-12 Feature Spec**: Lines 169-186 define this endpoint
- **Data Plan**: Lines 646-655 define PlayerCombatHistory schema
- **API Contracts**: Lines 1894-1915 define OpenAPI spec

**Database Schema** (PlayerCombatHistory):
```sql
CREATE TABLE player_combat_history (
  user_id UUID REFERENCES users(id),
  location_id UUID REFERENCES locations(id),
  total_attempts INTEGER NOT NULL DEFAULT 0,
  victories INTEGER NOT NULL DEFAULT 0,
  defeats INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, location_id)
);
```

**Implementation Status**: ❌ **NOT IMPLEMENTED** - Missing endpoint in controller and service method

---

## Implementation Priorities

### ✅ Completed
- All core currency operations (balance queries, add/deduct, affordability)
- Zod validation schemas in `schemas.ts`
- Transaction logging with atomic operations
- Error handling with specific error codes

### ❌ Missing Implementation
1. **Combat History Endpoint** (`GET /players/combat-history/:location_id`)
   - Add `getCombatHistory` method to EconomyController
   - Implement `getCombatHistory` in EconomyService
   - ✅ Route registration completed in economy routes
   - Create PlayerCombatHistory repository methods

### 🔄 Validation Needed
- Verify all transaction sourceType/sinkType enums match service validation
- Test insufficient funds error handling
- Confirm JWT auth middleware integration

---

## Related Files

**Controller**: `mystica-express/src/controllers/EconomyController.ts`
**Service**: `mystica-express/src/services/EconomyService.ts`
**Schemas**: `mystica-express/src/types/schemas.ts` (lines with AffordabilityCheckSchema, AddCurrencySchema, DeductCurrencySchema)
**API Types**: `mystica-express/src/types/api.types.ts` (CurrencyOperationResult, AffordabilityResult, etc.)
**Routes**: `mystica-express/src/routes/economy.ts` ✅ **IMPLEMENTED** - route registration complete
**Feature Specs**: `docs/feature-specs/F-12-enemy-ai-personality-system.yaml`
**API Contracts**: `docs/api-contracts.yaml` (lines 1894-1915)
**Data Schema**: `docs/data-plan.yaml` (lines 646-655 PlayerCombatHistory, 334-349 EconomyTransactions, 386-394 UserCurrencyBalances)

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- EconomyService (core currency operations with atomic transaction logging)
- AnalyticsService (combat history tracking and performance metrics)

### Dependents
**Controllers that use this controller:**
- **ItemController** (currency validation and deduction for upgrades and material replacement)
- **MaterialController** (currency deduction for material operations)
- **CombatController** (currency rewards from combat victories)
- **ProgressionController** (currency rewards from level-up claims)

### Related Features
- **F-12 Enemy AI - Combat History** - Player performance tracking per location for AI context generation
- **F-06 Item Upgrades** - Currency deduction for upgrade costs
- **F-05 Material Replacement** - Currency validation and deduction for material swapping
- **F-02 Combat System** - Currency rewards from combat victories

### Data Models
- UserCurrencyBalances table (docs/data-plan.yaml:127-139)
- EconomyTransactions table (docs/data-plan.yaml:142-159)
- PlayerCombatHistory table (docs/data-plan.yaml:646-655)

### Integration Notes
- **Currency Foundation**: Provides centralized currency management for all game economic activities
- **Transaction Logging**: All currency operations are atomically logged for audit trails
- **Combat Integration**: Tracks player performance history for AI personality generation
- **Purchase Validation**: Pre-validates affordability before expensive operations