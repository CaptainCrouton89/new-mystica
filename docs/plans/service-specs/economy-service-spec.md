# Economy Service Specification

**Created:** 2025-01-27
**Author:** Claude Code
**Status:** Draft
**Document Version:** 1.0
**Related Features:** F-04 Materials System, F-06 Item Upgrade System, F-07 Authentication
**Target Release:** MVP0/1

## Overview

EconomyService provides centralized currency management for the New Mystica game economy. It handles atomic currency operations with transaction logging, balance validation, and audit trails. This service acts as a thin wrapper over ProfileRepository RPC functions while providing a clean interface for other services.

### Core Responsibilities

- **Atomic Currency Operations**: Add/deduct gold and gems with transaction logging
- **Balance Management**: Retrieve current balances and validate sufficient funds
- **Transaction Auditing**: Complete audit trail for all currency changes
- **Error Handling**: Consistent error responses for insufficient funds and validation failures

### Supported Currencies

- **GOLD**: Primary in-game currency for upgrades and material replacements
- **GEMS**: Premium currency (reserved for future use)

## Dependencies

- **ProfileRepository**: Uses RPC functions directly for atomic operations
- **Database RPC Functions**: `add_currency_with_logging()`, `deduct_currency_with_logging()`
- **Database Tables**: `usercurrencybalances`, `economytransactions`

## Service Methods

### Core Currency Operations

#### `addCurrency(userId: string, currency: 'GOLD' | 'GEMS', amount: number, sourceType: string, sourceId?: string, metadata?: object): Promise<CurrencyOperationResult>`

**Purpose**: Add currency to user's balance with transaction logging.

**Implementation**:
```typescript
async addCurrency(
  userId: string,
  currency: 'GOLD' | 'GEMS',
  amount: number,
  sourceType: TransactionSourceType,
  sourceId?: string,
  metadata?: object
): Promise<CurrencyOperationResult> {
  // Input validation
  if (amount <= 0) {
    throw new ValidationError('Amount must be positive');
  }

  if (!this.isValidSourceType(sourceType)) {
    throw new ValidationError(`Invalid source type: ${sourceType}`);
  }

  try {
    // Call RPC function for atomic operation
    const response = await this.profileRepository.addCurrencyWithLogging(
      userId,
      currency,
      amount,
      sourceType,
      sourceId || null,
      metadata || {}
    );

    if (!response.success) {
      throw new DatabaseError(`Currency addition failed: ${response.message}`);
    }

    return {
      success: true,
      previousBalance: response.data.previous_balance,
      newBalance: response.data.new_balance,
      transactionId: response.data.transaction_id,
      currency,
      amount
    };
  } catch (error) {
    throw new DatabaseError(`Failed to add ${currency}: ${error.message}`);
  }
}
```

**Source Types** (Transaction Sources):
- `combat_victory` - Gold earned from defeating enemies
- `daily_quest` - Rewards from completing daily quests
- `achievement` - Milestone achievement rewards
- `iap` - In-app purchase currency grants
- `admin` - Administrative currency adjustments
- `profile_init` - Initial currency balance (0) for new users

**Response Schema**:
```typescript
interface CurrencyOperationResult {
  success: boolean;
  previousBalance: number;
  newBalance: number;
  transactionId: string;
  currency: 'GOLD' | 'GEMS';
  amount: number;
}
```

#### `deductCurrency(userId: string, currency: 'GOLD' | 'GEMS', amount: number, sourceType: string, sourceId?: string, metadata?: object): Promise<CurrencyOperationResult>`

**Purpose**: Deduct currency from user's balance with validation and transaction logging.

**Implementation**:
```typescript
async deductCurrency(
  userId: string,
  currency: 'GOLD' | 'GEMS',
  amount: number,
  sourceType: TransactionSinkType,
  sourceId?: string,
  metadata?: object
): Promise<CurrencyOperationResult> {
  // Input validation
  if (amount <= 0) {
    throw new ValidationError('Amount must be positive');
  }

  if (!this.isValidSinkType(sourceType)) {
    throw new ValidationError(`Invalid sink type: ${sourceType}`);
  }

  try {
    // Call RPC function for atomic operation with balance check
    const response = await this.profileRepository.deductCurrencyWithLogging(
      userId,
      currency,
      amount,
      sourceType,
      sourceId || null,
      metadata || {}
    );

    if (!response.success) {
      if (response.error_code === 'INSUFFICIENT_FUNDS') {
        throw new InsufficientFundsError(
          `Not enough ${currency}. Required: ${amount}, Available: ${this.extractCurrentBalance(response.message)}`
        );
      }
      throw new DatabaseError(`Currency deduction failed: ${response.message}`);
    }

    return {
      success: true,
      previousBalance: response.data.previous_balance,
      newBalance: response.data.new_balance,
      transactionId: response.data.transaction_id,
      currency,
      amount: -amount // Negative to indicate deduction
    };
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      throw error; // Re-throw custom error
    }
    throw new DatabaseError(`Failed to deduct ${currency}: ${error.message}`);
  }
}
```

**Sink Types** (Transaction Sinks):
- `item_upgrade` - Gold spent on item level upgrades
- `material_replacement` - Gold spent replacing item materials
- `shop_purchase` - Currency spent in item shops
- `loadout_slot_unlock` - Gold spent unlocking additional loadout slots

#### `getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number>`

**Purpose**: Get current balance for a specific currency type.

**Implementation**:
```typescript
async getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number> {
  try {
    const balance = await this.profileRepository.getCurrencyBalance(userId, currency);
    return balance || 0; // Return 0 if no balance record exists
  } catch (error) {
    throw new DatabaseError(`Failed to get ${currency} balance: ${error.message}`);
  }
}
```

**Error Handling**:
- Returns 0 for users with no balance records (new users)
- Throws DatabaseError for connection issues

#### `getAllBalances(userId: string): Promise<CurrencyBalances>`

**Purpose**: Get all currency balances for a user.

**Implementation**:
```typescript
async getAllBalances(userId: string): Promise<CurrencyBalances> {
  try {
    const balances = await this.profileRepository.getAllCurrencyBalances(userId);
    return {
      GOLD: balances.GOLD || 0,
      GEMS: balances.GEMS || 0
    };
  } catch (error) {
    throw new DatabaseError(`Failed to get currency balances: ${error.message}`);
  }
}
```

**Response Schema**:
```typescript
interface CurrencyBalances {
  GOLD: number;
  GEMS: number;
}
```

### Validation Methods

#### `validateSufficientFunds(userId: string, currency: 'GOLD' | 'GEMS', amount: number): Promise<boolean>`

**Purpose**: Check if user has sufficient funds without modifying balance.

**Implementation**:
```typescript
async validateSufficientFunds(
  userId: string,
  currency: 'GOLD' | 'GEMS',
  amount: number
): Promise<boolean> {
  const currentBalance = await this.getCurrencyBalance(userId, currency);
  return currentBalance >= amount;
}
```

**Usage**: Called by other services before expensive operations to validate funds early.

#### `getAffordabilityCheck(userId: string, currency: 'GOLD' | 'GEMS', amount: number): Promise<AffordabilityResult>`

**Purpose**: Get detailed affordability information including shortfall.

**Implementation**:
```typescript
async getAffordabilityCheck(
  userId: string,
  currency: 'GOLD' | 'GEMS',
  amount: number
): Promise<AffordabilityResult> {
  const currentBalance = await this.getCurrencyBalance(userId, currency);
  const canAfford = currentBalance >= amount;

  return {
    canAfford,
    currentBalance,
    requiredAmount: amount,
    shortfall: canAfford ? 0 : amount - currentBalance
  };
}
```

**Response Schema**:
```typescript
interface AffordabilityResult {
  canAfford: boolean;
  currentBalance: number;
  requiredAmount: number;
  shortfall: number; // 0 if can afford
}
```

## Error Classes

### InsufficientFundsError
```typescript
export class InsufficientFundsError extends Error {
  constructor(message: string, public currentBalance?: number, public requiredAmount?: number) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}
```

**Usage**: Thrown when deduction operations fail due to insufficient balance.

### ValidationError
```typescript
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**Usage**: Thrown for invalid amounts, currencies, or transaction types.

### DatabaseError
```typescript
export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
```

**Usage**: Thrown for RPC function failures and connection issues.

## Transaction Types Reference

### Source Types (Currency Addition)
| Type | Description | Used By |
|------|-------------|---------|
| `combat_victory` | Gold earned from defeating enemies | CombatService |
| `daily_quest` | Daily quest completion rewards | QuestService |
| `achievement` | Milestone achievement rewards | AchievementService |
| `iap` | In-app purchase currency grants | IAPService |
| `admin` | Administrative adjustments | AdminService |
| `profile_init` | Initial balance for new users | ProfileService |

### Sink Types (Currency Deduction)
| Type | Description | Used By |
|------|-------------|---------|
| `item_upgrade` | Gold spent on item level upgrades | ItemService |
| `material_replacement` | Gold spent replacing materials | MaterialService |
| `shop_purchase` | Currency spent in shops | ShopService |
| `loadout_slot_unlock` | Gold spent unlocking loadout slots | LoadoutService |

## Database Integration

### RPC Function Contracts

#### `add_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)`

**Returns**: JSONB with success/error status and transaction details
```json
{
  "success": true,
  "data": {
    "previous_balance": 1500,
    "new_balance": 2000,
    "transaction_id": "uuid-here"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error_code": "INVALID_AMOUNT",
  "message": "Amount must be positive"
}
```

#### `deduct_currency_with_logging(p_user_id, p_currency_code, p_amount, p_source_type, p_source_id, p_metadata)`

**Returns**: JSONB with success/error status and transaction details

**Insufficient Funds Response**:
```json
{
  "success": false,
  "error_code": "INSUFFICIENT_FUNDS",
  "message": "Not enough GOLD (have: 100, need: 500)"
}
```

### Table Dependencies

#### UserCurrencyBalances
- **Primary Key**: (user_id, currency_code)
- **Columns**: user_id, currency_code, balance, updated_at
- **Constraints**: Balance cannot be negative (enforced by RPC)

#### EconomyTransactions
- **Primary Key**: id (UUID)
- **Columns**: user_id, currency, amount, transaction_type, balance_after, source_type, source_id, metadata, created_at
- **Indexes**: user_id, currency, created_at for transaction history queries

## Usage Examples

### Item Upgrade Payment
```typescript
// In ItemService.upgradeItem()
const upgradeCost = await this.getUpgradeCost(userId, itemId);

// Check affordability first
const affordability = await this.economyService.getAffordabilityCheck(
  userId, 'GOLD', upgradeCost.cost
);

if (!affordability.canAfford) {
  throw new InsufficientFundsError(
    `Need ${affordability.shortfall} more gold for upgrade`
  );
}

// Deduct payment
const result = await this.economyService.deductCurrency(
  userId, 'GOLD', upgradeCost.cost, 'item_upgrade', itemId, {
    from_level: currentLevel,
    to_level: currentLevel + 1
  }
);
```

### Combat Victory Reward
```typescript
// In CombatService.processCombatResult()
if (result.outcome === 'victory') {
  const goldReward = this.calculateGoldReward(enemy, location);

  await this.economyService.addCurrency(
    userId, 'GOLD', goldReward, 'combat_victory', enemy.id, {
      enemy_type: enemy.type,
      location_id: location.id,
      difficulty_multiplier: 1.0
    }
  );
}
```

### Material Replacement Cost
```typescript
// In MaterialService.replaceMaterial()
const replacementCost = await this.getReplacementCost(itemId, slotIndex);

try {
  await this.economyService.deductCurrency(
    userId, 'GOLD', replacementCost, 'material_replacement', itemId, {
      slot_index: slotIndex,
      old_material_id: oldMaterial.id,
      new_material_id: newMaterial.id
    }
  );
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    throw new BusinessLogicError(`Cannot afford material replacement: ${error.message}`);
  }
  throw error;
}
```

## Testing Strategy

### Unit Tests
- **Currency Operations**: Mock ProfileRepository RPC responses
- **Validation Logic**: Test negative amounts, invalid currencies
- **Error Handling**: Test insufficient funds, database errors
- **Transaction Types**: Validate source/sink type validation

### Integration Tests
- **RPC Function Integration**: Test actual database operations
- **Transaction Logging**: Verify EconomyTransactions records
- **Concurrent Operations**: Test race conditions on balance updates
- **Error Recovery**: Test partial failure scenarios

### Test Data Scenarios
```typescript
// Setup test user with known balances
const userId = 'test-user-uuid';
await setupTestUserWithBalance(userId, { GOLD: 1000, GEMS: 50 });

// Test successful deduction
const result = await economyService.deductCurrency(
  userId, 'GOLD', 500, 'item_upgrade', 'item-uuid'
);
expect(result.newBalance).toBe(500);

// Test insufficient funds
await expect(
  economyService.deductCurrency(userId, 'GOLD', 2000, 'item_upgrade')
).rejects.toThrow(InsufficientFundsError);
```

## Performance Considerations

- **RPC Function Overhead**: ~5-10ms per operation (atomic but slower than direct queries)
- **Transaction Logging**: Every operation creates audit record (required for economy integrity)
- **Balance Queries**: Fast (~1-2ms) using primary key lookups
- **Concurrent Safety**: RPC functions handle concurrent operations with proper locking

## Security Considerations

- **Input Validation**: All amounts must be positive integers
- **Transaction Logging**: Complete audit trail for fraud detection
- **Authorization**: All operations require valid user ID from JWT
- **No Direct Balance Manipulation**: All changes go through logged RPC functions

## Future Enhancements

### MVP1+ Features
- **Currency Conversion**: Exchange rates between GOLD and GEMS
- **Transaction History API**: Query user transaction history
- **Spending Analytics**: Track spending patterns by category
- **Balance Alerts**: Notify on low balance conditions

### Performance Optimizations
- **Balance Caching**: Cache frequent balance lookups in Redis
- **Batch Operations**: Support bulk currency operations
- **Transaction Summarization**: Aggregate transaction history for reporting

## See Also

### Related Service Specifications
- **[ProfileService](./profile-service-spec.md)** - Primary consumer of currency operations for profile initialization
- **[ItemService](./item-service-spec.md)** - Uses deductCurrency for item upgrades and validates affordability
- **[MaterialService](./material-service-spec.md)** - Uses deductCurrency for material replacement costs

### Database References
- **RPC Functions**: `add_currency_with_logging()`, `deduct_currency_with_logging()`
- **Tables**: UserCurrencyBalances, EconomyTransactions

### Cross-Referenced Features
- **F-06**: Item Upgrade System (gold deduction for upgrades)
- **F-04**: Materials System (gold deduction for material replacements)
- **F-07**: Authentication (currency initialization for new users)