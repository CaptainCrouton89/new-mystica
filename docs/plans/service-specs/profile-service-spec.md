# Profile Service Specification

**Created:** 2025-01-23
**Author:** Claude Code
**Status:** Draft

## Overview

ProfileService and ProfileController handle user profile operations, currency management, progression tracking, and profile initialization. This service is the central hub for user account data, economy transactions, and derived statistics.

## Dependencies

- **ProfileRepository**: Direct data access layer
- **RPC Functions**: `add_currency_with_logging()`, `deduct_currency_with_logging()`, `add_xp_and_level_up()`
- **Database Tables**: users, usercurrencybalances, economytransactions, playerprogression, devicetokens

## Core Responsibilities

### 1. User Profile Management
- Profile retrieval with aggregated stats
- Profile initialization for new users
- Last login timestamp tracking
- Derived stat calculations (vanity level, avg item level)

### 2. Currency System
- Multi-currency balance management (GOLD, GEMS)
- Atomic currency operations with transaction logging
- Transaction history and audit trails
- Economy integrity enforcement

### 3. Player Progression
- XP tracking and level-up calculations
- Achievement milestone recording
- Progression analytics

### 4. Device Management
- Push notification token registration
- Multi-device support preparation

## API Endpoints

### GET /profile

**Purpose**: Retrieve complete user profile with stats and currency balances.

**Security**: Requires valid JWT token in Authorization header.

**Implementation**:
```typescript
async getProfile(userId: string): Promise<UserProfile> {
  // 1. Get base user data
  const user = await this.profileRepository.findUserById(userId);
  if (!user) throw new NotFoundError('User not found');

  // 2. Get currency balances
  const balances = await this.profileRepository.getAllCurrencyBalances(userId);

  // 3. Get progression data
  const progression = await this.profileRepository.getProgression(userId);

  // 4. Calculate total stats from equipped items (if needed)
  const totalStats = await this.calculateTotalStats(userId);

  // 5. Return aggregated profile
  return {
    id: user.id,
    email: user.email,
    device_id: user.device_id,
    account_type: user.account_type,
    username: user.username,
    vanity_level: user.vanity_level,
    gold: balances.GOLD,
    gems: balances.GEMS,
    total_stats: totalStats,
    level: progression?.level || 1,
    xp: progression?.xp || 0,
    created_at: user.created_at,
    last_login: user.last_login
  };
}
```

**Response Schema**:
```typescript
interface UserProfile {
  id: string;           // UUID
  email: string | null; // null for anonymous accounts
  device_id: string | null;
  account_type: 'anonymous' | 'email';
  username: string | null;
  vanity_level: number; // Sum of equipped item levels
  gold: number;         // From UserCurrencyBalances
  gems: number;         // From UserCurrencyBalances
  total_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
  };
  level: number;        // From PlayerProgression
  xp: number;          // From PlayerProgression
  created_at: string;
  last_login: string;
}
```

**Error Handling**:
- `401`: Invalid/missing JWT token
- `404`: User not found
- `500`: Database connection or internal errors

### POST /profile/init

**Purpose**: Initialize new player profile with starter inventory (1 random common item, 0 gold).

**Security**: Requires valid JWT token. User must not already have initialized profile.

**Implementation**:
```typescript
async initializeProfile(userId: string): Promise<UserProfile> {
  // 1. Check if already initialized
  const existingItems = await this.inventoryRepository.getUserItems(userId);
  if (existingItems.length > 0) {
    throw new BusinessLogicError('Profile already initialized');
  }

  // 2. Initialize currency balances (0 GOLD, 0 GEMS)
  await this.profileRepository.addCurrency(userId, 'GOLD', 0, 'profile_init');
  await this.profileRepository.addCurrency(userId, 'GEMS', 0, 'profile_init');

  // 3. Create random common item
  const commonItemTypes = await this.inventoryRepository.getItemTypesByRarity('common');
  const randomItemType = commonItemTypes[Math.floor(Math.random() * commonItemTypes.length)];

  const starterItem = await this.inventoryRepository.createItem(userId, randomItemType.id, {
    level: 1,
    source: 'starter_item'
  });

  // 4. Initialize progression
  await this.profileRepository.updateProgression(userId, {
    xp: 0,
    level: 1,
    xp_to_next_level: 100, // Standard level 1→2 requirement
    last_level_up_at: null
  });

  // 5. Log profile initialization event
  await this.analyticsService.trackEvent(userId, 'profile_initialized', {
    starter_item_id: starterItem.id,
    starter_item_type: randomItemType.name
  });

  // 6. Return complete profile
  return this.getProfile(userId);
}
```

**Business Rules**:
- Must create exactly 1 random common rarity item
- Must initialize with 0 GOLD (not default starting amount)
- Must create PlayerProgression record with level 1, 0 XP
- Must be idempotent (safe to call multiple times)
- Must fail if user already has items (profile already initialized)

**Response Schema**: Same as GET /profile

**Error Handling**:
- `401`: Invalid/missing JWT token
- `409`: Profile already initialized (user has existing items)
- `500`: Database errors, item creation failures

## Service Methods

### Currency Operations

#### `getCurrencyBalance(userId: string, currency: 'GOLD' | 'GEMS'): Promise<number>`
- Delegates to ProfileRepository.getCurrencyBalance
- Returns 0 if no balance record exists
- Used for balance checks before transactions

#### `getAllCurrencyBalances(userId: string): Promise<{GOLD: number, GEMS: number}>`
- Retrieves all currency balances for user
- Returns {GOLD: 0, GEMS: 0} if no records exist
- Used in profile aggregation

#### `addCurrency(userId, currency, amount, sourceType, sourceId?, metadata?): Promise<number>`
- **CRITICAL**: Uses RPC function `add_currency_with_logging()`
- Atomic operation: updates balance + logs transaction
- Returns new balance after addition
- Common source types: `combat_victory`, `daily_quest`, `achievement`, `iap`, `admin`

#### `deductCurrency(userId, currency, amount, sourceType, sourceId?, metadata?): Promise<number>`
- **CRITICAL**: Uses RPC function `deduct_currency_with_logging()`
- Atomic operation: checks funds + updates balance + logs transaction
- Throws BusinessLogicError on insufficient funds
- Returns new balance after deduction
- Common source types: `item_upgrade`, `material_replacement`, `shop_purchase`

### Progression System

#### `getProgression(userId: string): Promise<PlayerProgression | null>`
- Returns null if no progression record exists (new user)
- Used to determine current level/XP for profile display

#### `addXP(userId: string, amount: number): Promise<{newXP: number, newLevel: number, leveledUp: boolean}>`
- **CRITICAL**: Uses RPC function `add_xp_and_level_up()`
- Handles automatic level-up calculations
- Returns detailed level-up information
- Triggers level-up events for analytics

### Derived Statistics

#### `updateVanityLevel(userId: string): Promise<number>`
- Recalculates vanity_level as sum of equipped item levels
- Usually triggered by database triggers on equipment changes
- Available for manual recalculation if triggers fail

#### `updateAvgItemLevel(userId: string): Promise<number>`
- Recalculates avg_item_level from equipped items
- Used for combat level scaling
- Critical for enemy pool selection

#### `calculateTotalStats(userId: string): Promise<CombatStats>`
- Aggregates stats from equipped items + materials
- May use database view `v_player_equipped_stats` in future
- Returns combat-ready stat totals

### Device Management

#### `registerDeviceToken(userId, platform, token): Promise<void>`
- Registers push notification tokens
- Handles UNIQUE constraint gracefully (transfers token to new user)
- Supports multiple tokens per user for multi-device

#### `getActiveDeviceTokens(userId: string): Promise<DeviceToken[]>`
- Returns active push notification tokens
- Used for targeted push notifications

## Critical Implementation Notes

### Currency Transaction Logging
**MANDATORY**: All currency changes MUST use RPC functions for atomicity:

```typescript
// ✅ CORRECT - Atomic with transaction logging
await this.profileRepository.deductCurrency(userId, 'GOLD', 500, 'item_upgrade', itemId);

// ❌ WRONG - No transaction logging, not atomic
await this.profileRepository.updateCurrencyBalance(userId, 'GOLD', newBalance);
```

**Transaction Types**:
- **Sources**: `combat_victory`, `daily_quest`, `achievement`, `iap`, `admin`, `profile_init`
- **Sinks**: `item_upgrade`, `material_replacement`, `shop_purchase`, `loadout_slot_unlock`

### Error Handling Patterns
```typescript
// Currency operations
if (amount <= 0) throw new ValidationError('Amount must be positive');

// Insufficient funds
if (rpcResponse.error_code === 'INSUFFICIENT_FUNDS') {
  throw new BusinessLogicError('Not enough gold');
}

// Profile already initialized
if (existingItems.length > 0) {
  throw new BusinessLogicError('Profile already initialized');
}
```

### Authentication Integration
- Service expects `req.user.id` from JWT middleware
- Must validate user existence before operations
- Update `last_login` on profile access

## Database Schema Dependencies

### Required Tables
- **users**: Base profile data, vanity_level, avg_item_level (cached)
- **usercurrencybalances**: Multi-currency support (GOLD, GEMS)
- **economytransactions**: Audit trail for all currency changes
- **playerprogression**: XP, level, level-up timestamps
- **devicetokens**: Push notification device registration

### Required RPC Functions
- **add_currency_with_logging()**: Atomic currency addition + logging
- **deduct_currency_with_logging()**: Atomic currency deduction + logging
- **add_xp_and_level_up()**: XP addition with automatic level calculation

### Database Triggers (Expected)
- **UserEquipment changes** → Recalculate users.vanity_level, users.avg_item_level
- **Item level changes** → Recalculate derived stats for equipped items

## Testing Strategy

### Unit Tests
- Currency operations with mocked RPC responses
- Profile aggregation with mocked repository data
- Error handling for insufficient funds, missing users
- Validation for negative amounts, invalid currencies

### Integration Tests
- Profile initialization end-to-end flow
- Currency transaction logging verification
- Multi-device token management
- Progression system with level-ups

### Load Testing
- Profile retrieval under concurrent requests
- Currency operations with high transaction volume
- Memory usage for large user bases

## Performance Considerations

- **Profile GET**: ~10-15ms (multiple table joins)
- **Currency operations**: ~5-10ms (RPC function overhead)
- **Profile init**: ~20-50ms (multiple inserts + item creation)
- **Cache consideration**: Profile data could be cached for 30-60 seconds
- **Bottleneck**: Database RPC function calls (unavoidable for consistency)

## Future Enhancements

### MVP1+ Features
- **Achievement system integration**: Track milestone progression
- **Login streak tracking**: Daily login rewards
- **Friend system**: Social profile features
- **Leaderboards**: Public profile stats for ranking

### Performance Optimizations
- **Materialized views**: Pre-compute v_player_equipped_stats
- **Profile caching**: Redis cache for frequently accessed profiles
- **Batch operations**: Bulk currency operations for events
- **Read replicas**: Separate read/write database connections

## Security Considerations

- **Authorization**: All operations require valid user ID from JWT
- **Rate limiting**: Profile operations should be rate-limited
- **Input validation**: All amounts must be positive integers
- **Audit trail**: Every currency change is logged with source tracking
- **Device token security**: Tokens should be rotated on logout

## Monitoring & Analytics

### Key Metrics
- **Profile retrieval latency**: P95 < 50ms
- **Currency operation success rate**: > 99.9%
- **Profile initialization success rate**: > 99.5%
- **Average profile age**: Days since creation
- **Currency distribution**: Gold/gem balance histograms

### Event Tracking
- `profile_initialized`: New user onboarding
- `currency_balance_changed`: Economy health monitoring
- `level_up_achieved`: Progression milestone tracking
- `device_token_registered`: Push notification capability

## See Also

### Related Service Specifications
- **[AuthService](./auth-service-spec.md)** - Uses ProfileRepository for user CRUD and currency initialization
- **[ItemService](./item-service-spec.md)** - Profile initialization creates starter inventory items
- **[MaterialService](./material-service-spec.md)** - Gold balance updates for material replacement costs
- **[EconomyService](./economy-service-spec.md)** - Centralized currency operations built on ProfileRepository RPC functions

### Missing Repository Methods
- **ProfileRepository.updateLastLogin()** ⚠️ NOT IN PROFILE SPEC - Referenced by AuthService and EquipmentService

### Cross-Referenced Features
- **F-07**: Authentication (profile creation and currency initialization)
- **F-03**: Base Items & Equipment (starter inventory creation)
- **F-04**: Materials System (currency operations for material replacement)
- **F-06**: Item Upgrade System (currency operations for upgrades)