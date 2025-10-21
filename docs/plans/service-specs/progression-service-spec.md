# ProgressionService Specification

## Overview

The ProgressionService handles player experience point (XP) progression, level calculations, and level reward claiming for the account-level progression system. It serves as the business logic layer for all XP-related operations and integrates with the economy system for reward distribution.

**Status**: ❌ NOT IMPLEMENTED - Needs creation

## Architecture

### Service Layer (ProgressionService)
- **File**: `mystica-express/src/services/ProgressionService.ts`
- **Purpose**: High-level business logic for XP progression and reward management
- **Status**: Not implemented (needs creation)

### Repository Layer (ProgressionRepository - Optional)
- **File**: `mystica-express/src/repositories/ProgressionRepository.ts`
- **Purpose**: Data access layer for progression-related database operations
- **Status**: Optional - could use ProfileRepository or create dedicated repository

### Database Layer
- **Tables**: PlayerProgression, LevelRewards, UserLevelRewards
- **Key Features**: XP tracking, level calculation, reward claim tracking
- **Constraints**: Level progression formulas, reward claim validation

## Core Features

### 1. XP Management

**Primary Method**: `ProgressionService.awardExperience(userId, xpAmount, source, sourceId?, metadata?)`
- Updates PlayerProgression.xp with atomic operations
- Recalculates level using progression formulas
- Handles level-up detection and reward eligibility
- Logs analytics events for XP gains and level-ups

**XP Calculation Formulas**:
```typescript
// XP required for next level: 100 * current_level
calculateXPToNextLevel(currentLevel: number): number {
  return 100 * currentLevel;
}

// Total XP required to reach a specific level
calculateTotalXPForLevel(targetLevel: number): number {
  let totalXP = 0;
  for (let level = 1; level < targetLevel; level++) {
    totalXP += this.calculateXPToNextLevel(level);
  }
  return totalXP;
}

// Calculate level from total XP
calculateLevelFromXP(totalXP: number): number {
  let level = 1;
  let requiredXP = 0;

  while (requiredXP <= totalXP) {
    const nextLevelXP = this.calculateXPToNextLevel(level);
    if (requiredXP + nextLevelXP > totalXP) break;
    requiredXP += nextLevelXP;
    level++;
  }

  return level;
}
```

### 2. Progression Status Retrieval

**Primary Method**: `ProgressionService.getPlayerProgression(userId)`
- Fetches current XP, level, and progress calculations
- Calculates XP to next level and progress percentage
- Returns structured progression status for UI display

**Implementation Details**:
```typescript
async getPlayerProgression(userId: string): Promise<ProgressionStatus> {
  const progression = await this.getProgressionData(userId);
  const currentLevel = this.calculateLevelFromXP(progression.xp);
  const xpToNext = this.calculateXPToNextLevel(currentLevel);
  const currentLevelXP = this.calculateTotalXPForLevel(currentLevel);
  const xpInCurrentLevel = progression.xp - currentLevelXP;

  return {
    user_id: userId,
    level: currentLevel,
    xp: progression.xp,
    xp_to_next_level: xpToNext - xpInCurrentLevel,
    xp_progress_percentage: (xpInCurrentLevel / xpToNext) * 100,
    level_rewards_available: await this.getAvailableLevelRewards(userId, currentLevel)
  };
}
```

### 3. Level Reward System

**Primary Method**: `ProgressionService.claimLevelReward(userId, level)`
- Validates player has reached the specified level
- Checks reward exists and is claimable
- Prevents double-claiming through UserLevelRewards tracking
- Integrates with EconomyService for gold rewards
- Creates audit trail of claimed rewards

**Business Logic Flow**:
1. Validate player has reached specified level
2. Check reward exists in LevelRewards table
3. Verify reward is claimable (`is_claimable = true`)
4. Check reward hasn't been claimed via UserLevelRewards
5. Process reward based on type:
   - **Gold**: Call `economyService.addCurrency()` with transaction logging
   - **Feature unlock**: Mark as claimed (automatic unlock)
   - **Cosmetic**: Grant cosmetic item (future implementation)
6. Create UserLevelRewards entry with claim timestamp
7. Log analytics event: `level_reward_claimed`

### 4. Level Reward Availability

**Primary Method**: `ProgressionService.getAvailableLevelRewards(userId, currentLevel)`
- Fetches all level rewards up to current level
- Filters for claimable rewards only
- Excludes already claimed rewards
- Returns formatted reward list for UI display

**Query Logic**:
```sql
SELECT lr.* FROM LevelRewards lr
WHERE lr.level <= ?
  AND lr.is_claimable = true
  AND NOT EXISTS (
    SELECT 1 FROM UserLevelRewards ulr
    WHERE ulr.user_id = ? AND ulr.level = lr.level
  )
ORDER BY lr.level ASC
```

## Service Method Specifications

### Core Methods

#### `awardExperience(userId: string, xpAmount: number, source: string, sourceId?: string, metadata?: object): Promise<ExperienceAwardResult>`

**Purpose**: Award XP and handle level-up logic with analytics tracking

**Parameters**:
- `userId`: Player UUID
- `xpAmount`: Positive integer XP to award
- `source`: XP source ('combat', 'quest', 'achievement', 'daily_bonus')
- `sourceId`: Optional reference ID for tracking
- `metadata`: Optional context data

**Returns**: ExperienceAwardResult with level change information

**Throws**:
- `ValidationError` - Invalid parameters or negative XP
- `DatabaseError` - Database operation failure
- `NotFoundError` - User progression record not found

**Business Logic**:
1. Validate XP amount is positive
2. Validate source type is allowed
3. Update PlayerProgression.xp atomically
4. Recalculate level and detect level-ups
5. Update last_level_up_at if level increased
6. Log analytics events
7. Return progression update results

#### `getPlayerProgression(userId: string): Promise<ProgressionStatus>`

**Purpose**: Get complete progression status including calculated values

**Parameters**:
- `userId`: Player UUID

**Returns**: ProgressionStatus with XP, level, progress, and available rewards

**Throws**:
- `DatabaseError` - Database query failure
- `NotFoundError` - Player progression not found

**Performance**: ~5-15ms with proper indexing

#### `claimLevelReward(userId: string, level: number): Promise<RewardClaimResult>`

**Purpose**: Process level reward claim with validation and economy integration

**Parameters**:
- `userId`: Player UUID
- `level`: Level reward to claim (must be reached)

**Returns**: RewardClaimResult with reward details and new balances

**Throws**:
- `ValidationError` - Level not reached or invalid
- `ConflictError` - Reward already claimed
- `NotFoundError` - Reward doesn't exist or not claimable
- `DatabaseError` - Database operation failure

**Database Transactions**: Required (atomic reward claim + currency addition)

#### `getAvailableLevelRewards(userId: string, currentLevel: number): Promise<LevelReward[]>`

**Purpose**: Get unclaimed rewards available to player

**Parameters**:
- `userId`: Player UUID
- `currentLevel`: Player's current level

**Returns**: Array of claimable LevelReward objects

**Throws**:
- `DatabaseError` - Database query failure

### Utility Methods

#### `calculateLevelFromXP(totalXP: number): number`

**Purpose**: Calculate player level from total XP using progression formula

**Formula**: Iterative calculation based on 100 * level XP requirements

#### `calculateXPToNextLevel(currentLevel: number): number`

**Purpose**: Calculate XP needed for next level

**Formula**: `100 * current_level`

#### `validateLevelReached(userId: string, targetLevel: number): Promise<boolean>`

**Purpose**: Check if player has reached specific level

**Returns**: Boolean indicating if level is reached

## Error Handling

### Service Layer Errors
- `ValidationError` - Invalid XP amounts, source types, or level parameters
- `ConflictError` - Reward already claimed or duplicate operations
- `NotFoundError` - Player progression or reward definitions not found
- `DatabaseError` - Database operation failures

### Integration Errors
- `InsufficientFundsError` - If economy service integration fails
- `TransactionError` - If atomic operations fail during reward claims

### API Layer Errors (from controller)
- `401` - Authentication failures
- `403` - Level not reached for reward claims
- `409` - Reward already claimed
- `422` - Non-claimable reward types
- `500` - Service layer errors

## Database Dependencies

### Tables Accessed
- **PlayerProgression** - Primary XP and level storage
- **LevelRewards** - Reward definitions and claimability rules
- **UserLevelRewards** - Claimed reward tracking with timestamps

### Key Indexes Needed
```sql
-- PlayerProgression optimization
CREATE INDEX idx_player_progression_user_id ON PlayerProgression(user_id);
CREATE INDEX idx_player_progression_level_xp ON PlayerProgression(level DESC, xp DESC);

-- LevelRewards optimization
CREATE INDEX idx_level_rewards_level ON LevelRewards(level);
CREATE INDEX idx_level_rewards_claimable ON LevelRewards(is_claimable, level);

-- UserLevelRewards optimization
CREATE INDEX idx_user_level_rewards_user_level ON UserLevelRewards(user_id, level);
```

## Repository Integration

### Option 1: Use ProfileRepository
- Extend existing ProfileRepository with progression methods
- Leverage existing RPC patterns for atomic operations
- Maintains consistency with other profile-related data

### Option 2: Create ProgressionRepository
- Dedicated repository for progression-specific operations
- Cleaner separation of concerns
- Easier testing and maintenance

**Recommended**: Create ProgressionRepository for better modularity

## Integration Points

### EconomyService Integration
- `economyService.addCurrency()` for gold reward distribution
- Transaction logging with progression-specific source types
- Atomic operations for reward claims

### Analytics Integration
- XP gain events with source tracking
- Level-up events with timing metrics
- Reward claim events for engagement analytics

### Combat System Integration
- Combat victory XP awards via internal API
- Enemy-specific XP bonuses based on difficulty
- Location-based XP multipliers (future enhancement)

## Performance Considerations

### Caching Strategy
- **Progression Status**: 1-minute cache with XP change invalidation
- **Level Rewards**: 24-hour cache (seed data, rarely changes)
- **Progression Calculations**: Memoize formula results for common levels

### Database Optimization
- Use database triggers for automatic level calculation
- Batch XP awards where possible to reduce writes
- Consider read replicas for progression leaderboards

### Scaling Characteristics
- **XP Awards**: 50-100ms including analytics logging
- **Progression Queries**: 5-15ms with proper indexing
- **Reward Claims**: 20-50ms including economy integration

## Security Considerations

### XP Award Validation
- Validate all XP sources to prevent exploitation
- Rate limiting on XP award endpoints
- Audit logging for all progression changes

### Reward Claim Security
- Atomic transactions prevent double-claiming
- Server-side level validation (never trust client)
- Comprehensive audit trail for debugging

### Anti-Cheat Measures
- Track XP gain rates and flag anomalies
- Validate XP sources match expected patterns
- Monitor for impossible progression speeds

## Testing Strategy

### Unit Tests Required
1. **XP Calculation Formulas**:
   - Test level calculation from various XP amounts
   - Verify XP-to-next-level calculations
   - Edge cases: level 1, level 50+, zero XP

2. **Progression Logic**:
   - XP award with level-up detection
   - Progress percentage calculations
   - Available rewards filtering

3. **Reward System**:
   - Reward claim validation
   - Double-claim prevention
   - Economy service integration

### Integration Tests Required
1. **Full Progression Flow**:
   - XP award → level up → reward availability → reward claim
   - Multi-level progression in single session
   - Concurrent XP awards and claims

2. **Database Integrity**:
   - Atomic operations during failures
   - Transaction rollback scenarios
   - Concurrent user operations

### Edge Cases
- **Level Boundaries**: Level 1, 49→50, max level progression
- **XP Overflow**: Large XP awards causing multiple level-ups
- **Corrupted Data**: Missing progression records, invalid levels
- **Concurrent Claims**: Multiple reward claims simultaneously

## Future Enhancements

### Prestige System (F-13)
- Level 50+ progression with prestige mechanics
- Prestige point calculation and benefits
- Extended reward chains

### Enhanced XP Sources
- Achievement-based XP bonuses
- Daily/weekly XP multipliers
- Social interaction XP rewards

### Advanced Analytics
- Player progression cohort analysis
- XP source effectiveness tracking
- Progression bottleneck identification

### Performance Optimizations
- Progression leaderboards with efficient ranking
- Real-time progression updates via WebSocket
- Progression milestone push notifications

---

**Implementation Priority**: High - Required for F-08 XP Progression System completion

**Dependencies**:
- PlayerProgression, LevelRewards, UserLevelRewards table schemas
- EconomyService for reward distribution
- Analytics service for event tracking

**Next Steps**:
1. Create ProgressionService class with core methods
2. Implement XP calculation formulas and progression logic
3. Add reward claim integration with EconomyService
4. Create comprehensive test suite
5. Integrate with ProgressionController endpoints