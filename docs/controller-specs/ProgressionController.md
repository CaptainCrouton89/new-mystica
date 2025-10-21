# ProgressionController Specification

## Controller Overview

**Purpose:** Handles player experience point (XP) progression, level calculations, and level reward claiming for the account-level progression system.

**Responsibility:** Provides endpoints for retrieving player progression status and claiming level-based rewards, integrating with the XP progression system and economy services.

**Feature Reference:** [F-08 XP Progression System](../feature-specs/F-08-xp-progression-system.yaml)

**Service Dependencies:**
- `ProgressionService` (NEW - needs creation)
- `EconomyService` (existing - for reward transactions)
- `AnalyticsService` (existing - for event tracking)

**File Location:** `mystica-express/src/controllers/ProgressionController.ts`

---

## Endpoint Specifications

### 1. GET /progression

**Route Handler:** `getPlayerProgression`

**Description:** Retrieves player's current XP, level, progress to next level, and any available unclaimed level rewards.

#### Request Specification

**HTTP Method:** `GET`
**Route Path:** `/api/v1/progression`
**Headers:**
- `Authorization: Bearer <jwt_token>` (required)

**Parameters:** None

**Query Parameters:** None

**Request Body:** None

#### Response Specification

**Success Response (200):**
```typescript
{
  success: true;
  progression: {
    user_id: string;           // UUID
    level: number;             // Current account level (1-50+)
    xp: number;                // Total XP earned
    xp_to_next_level: number;  // XP needed for next level
    xp_progress_percentage: number; // Progress to next level (0.0-100.0)
    level_rewards_available: Array<{
      level: number;
      reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
      reward_description: string;
      reward_value: number;
      is_claimable: boolean;
    }>;
  };
}
```

**Error Responses:**

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication required"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "PROGRESSION_NOT_FOUND",
    message: "Player progression data not found"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_ERROR",
    message: "Failed to retrieve progression data"
  }
}
```

#### Implementation Details

**Middleware Chain:**
1. `authenticate` - Validates JWT token, populates `req.user`

**Service Method Calls:**
- `progressionService.getPlayerProgression(userId: string)`
- `progressionService.getAvailableLevelRewards(userId: string, currentLevel: number)`

**Business Logic Flow:**
1. Extract `user_id` from authenticated request
2. Fetch player progression data from PlayerProgression table
3. Calculate `xp_progress_percentage` using progression formulas
4. Query available unclaimed level rewards from LevelRewards/UserLevelRewards tables
5. Return structured progression status

**Zod Schema:** N/A (no request body)

**Caching:** Consider 1-minute cache on progression data, invalidate on XP changes

---

### 2. POST /progression/level-up

**Route Handler:** `claimLevelReward`

**Description:** Claims available level milestone rewards (gold, cosmetics, etc.) for the authenticated user.

#### Request Specification

**HTTP Method:** `POST`
**Route Path:** `/api/v1/progression/level-up`
**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `Content-Type: application/json` (required)

**Parameters:** None

**Query Parameters:** None

**Request Body:**
```typescript
{
  level: number; // Level reward to claim (must be integer, >= 1)
}
```

**Zod Schema:**
```typescript
export const ClaimLevelRewardSchema = z.object({
  level: z.number().int().min(1, 'Level must be at least 1')
});

export type ClaimLevelRewardRequest = z.infer<typeof ClaimLevelRewardSchema>;
```

#### Response Specification

**Success Response (200):**
```typescript
{
  success: true;
  reward: {
    level: number;
    reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
    reward_amount: number;
    reward_description: string;
    new_gold_balance?: number; // Only included for gold rewards
    claimed_at: string;        // ISO timestamp
  };
}
```

**Error Responses:**

**400 Bad Request:**
```typescript
{
  error: {
    code: "INVALID_LEVEL",
    message: "Invalid level or reward not available"
  }
}
```

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Level must be at least 1"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Authentication required"
  }
}
```

**403 Forbidden:**
```typescript
{
  error: {
    code: "LEVEL_NOT_REACHED",
    message: "Player has not reached the specified level"
  }
}
```

**409 Conflict:**
```typescript
{
  error: {
    code: "REWARD_ALREADY_CLAIMED",
    message: "Level reward has already been claimed"
  }
}
```

**422 Unprocessable Entity:**
```typescript
{
  error: {
    code: "REWARD_NOT_CLAIMABLE",
    message: "This level reward is automatically granted and cannot be manually claimed"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_ERROR",
    message: "Failed to process level reward claim"
  }
}
```

#### Implementation Details

**Middleware Chain:**
1. `authenticate` - Validates JWT token, populates `req.user`
2. `validate({ body: ClaimLevelRewardSchema })` - Validates request body, populates `req.validated`

**Service Method Calls:**
- `progressionService.getPlayerProgression(userId: string)`
- `progressionService.getLevelReward(level: number)`
- `progressionService.hasClaimedReward(userId: string, level: number)`
- `progressionService.claimLevelReward(userId: string, level: number)`
- `economyService.addCurrency(userId, 'GOLD', amount, 'level_reward', levelString, metadata)` (for gold rewards)

**Business Logic Flow:**
1. Extract `user_id` from authenticated request
2. Extract and validate `level` from request body
3. Verify player has reached the specified level
4. Check that reward exists and is claimable (`is_claimable = true`)
5. Verify reward hasn't already been claimed
6. Process reward based on type:
   - **Gold rewards:** Add currency via EconomyService, create EconomyTransaction
   - **Feature unlocks:** Mark as claimed (automatic unlock)
   - **Cosmetics:** Grant cosmetic item (future implementation)
7. Create UserLevelRewards entry with claim timestamp
8. Log analytics event: `level_reward_claimed`
9. Return success response with reward details

**Database Transactions:**
- **Required:** Claiming rewards must be atomic (UserLevelRewards + EconomyTransactions)
- **Isolation Level:** READ_COMMITTED to prevent double-claiming

**Analytics Events:**
```typescript
// Event: level_reward_claimed
{
  user_id: string;
  level: number;
  reward_type: string;
  reward_amount: number;
  new_gold_balance?: number;
  time_since_level_up_seconds: number;
  timestamp: datetime;
}
```

---

## Internal API Endpoints

### POST /progression/award-xp (Internal)

**Route Handler:** `awardExperience`

**Description:** Internal endpoint for awarding XP from game activities. Called by combat system, quest system, etc.

**Note:** This endpoint is for internal service-to-service communication and should be protected by internal API authentication.

#### Request Specification

**HTTP Method:** `POST`
**Route Path:** `/api/v1/progression/award-xp` (internal only)
**Headers:**
- `X-Internal-Service: <service_name>` (required)
- `Content-Type: application/json` (required)

**Request Body:**
```typescript
{
  user_id: string;    // UUID - target user
  xp_amount: number;  // XP to award (positive integer)
  source: string;     // XP source ('combat', 'quest', 'achievement')
  source_id?: string; // Optional UUID - combat session, quest ID, etc.
  metadata?: object;  // Optional additional context
}
```

**Zod Schema:**
```typescript
export const AwardExperienceSchema = z.object({
  user_id: UUIDSchema,
  xp_amount: z.number().int().positive('XP amount must be positive'),
  source: z.enum(['combat', 'quest', 'achievement', 'daily_bonus']),
  source_id: UUIDSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type AwardExperienceRequest = z.infer<typeof AwardExperienceSchema>;
```

#### Response Specification

**Success Response (200):**
```typescript
{
  success: true;
  result: {
    user_id: string;
    old_level: number;
    new_level: number;
    leveled_up: boolean;
    total_xp: number;
    xp_awarded: number;
  };
}
```

#### Implementation Details

**Middleware Chain:**
1. `authenticateInternal` - Validates internal service authentication
2. `validate({ body: AwardExperienceSchema })` - Validates request body

**Service Method Calls:**
- `progressionService.awardExperience(userId, xpAmount, source, sourceId, metadata)`
- `progressionService.calculateLevelFromXP(totalXP)`

**Business Logic Flow:**
1. Validate internal service authentication
2. Extract and validate request parameters
3. Update PlayerProgression.xp (add XP amount)
4. Recalculate level using progression formulas
5. Update PlayerProgression.level and last_level_up_at if level increased
6. Log analytics events: `xp_gained`, `level_up` (if applicable)
7. Return progression update results

---

## Required Zod Schemas

Add to `mystica-express/src/types/schemas.ts`:

```typescript
// Progression endpoints
export const ClaimLevelRewardSchema = z.object({
  level: z.number().int().min(1, 'Level must be at least 1')
});

export const AwardExperienceSchema = z.object({
  user_id: UUIDSchema,
  xp_amount: z.number().int().positive('XP amount must be positive'),
  source: z.enum(['combat', 'quest', 'achievement', 'daily_bonus']),
  source_id: UUIDSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

// Type exports for progression
export type ClaimLevelRewardRequest = z.infer<typeof ClaimLevelRewardSchema>;
export type AwardExperienceRequest = z.infer<typeof AwardExperienceSchema>;
```

---

## Required API Types

Add to `mystica-express/src/types/api.types.ts`:

```typescript
/**
 * Player progression information
 */
export interface PlayerProgression {
  user_id: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  last_level_up_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Level reward definition
 */
export interface LevelReward {
  level: number;
  reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
  reward_value: number;
  reward_description: string;
  is_claimable: boolean;
  created_at: string;
}

/**
 * User's claimed level reward
 */
export interface UserLevelReward {
  user_id: string;
  level: number;
  claimed_at: string;
  reward_amount: number;
}

/**
 * Progression status response
 */
export interface ProgressionStatus {
  user_id: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  xp_progress_percentage: number;
  level_rewards_available: Array<{
    level: number;
    reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
    reward_description: string;
    reward_value: number;
    is_claimable: boolean;
  }>;
}

/**
 * Level reward claim result
 */
export interface RewardClaimResult {
  level: number;
  reward_type: 'gold' | 'feature_unlock' | 'cosmetic';
  reward_amount: number;
  reward_description: string;
  new_gold_balance?: number;
  claimed_at: string;
}

/**
 * XP award result
 */
export interface ExperienceAwardResult {
  user_id: string;
  old_level: number;
  new_level: number;
  leveled_up: boolean;
  total_xp: number;
  xp_awarded: number;
}
```

---

## Route Registration

Add to `mystica-express/src/routes/index.ts`:

```typescript
import progressionRoutes from './progression.js';

// Register progression routes
app.use('/api/v1/progression', progressionRoutes);
```

Create `mystica-express/src/routes/progression.ts`:

```typescript
import { Router } from 'express';
import { authenticate, authenticateInternal } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ProgressionController } from '../controllers/ProgressionController';
import { ClaimLevelRewardSchema, AwardExperienceSchema } from '../types/schemas';

const router = Router();
const controller = new ProgressionController();

/**
 * Progression Routes
 *
 * GET  /progression           - Get player progression status
 * POST /progression/level-up  - Claim level milestone reward
 * POST /progression/award-xp  - Award XP (internal API)
 */

// Get player progression status
router.get('/', authenticate, controller.getPlayerProgression);

// Claim level milestone reward
router.post('/level-up',
  authenticate,
  validate({ body: ClaimLevelRewardSchema }),
  controller.claimLevelReward
);

// Award experience points (internal API)
router.post('/award-xp',
  authenticateInternal,
  validate({ body: AwardExperienceSchema }),
  controller.awardExperience
);

export default router;
```

---

## Integration Requirements

### Database Tables

**Required Tables:** (Already defined in F-08 spec)
- `PlayerProgression` - XP and level tracking
- `LevelRewards` - Reward definitions (seed data)
- `UserLevelRewards` - Claimed rewards tracking

### Service Dependencies

**ProgressionService** (NEW - needs implementation):
- `getPlayerProgression(userId: string): Promise<ProgressionStatus>`
- `getAvailableLevelRewards(userId: string, currentLevel: number): Promise<LevelReward[]>`
- `claimLevelReward(userId: string, level: number): Promise<RewardClaimResult>`
- `awardExperience(userId: string, xpAmount: number, source: string, sourceId?: string, metadata?: object): Promise<ExperienceAwardResult>`
- `calculateLevelFromXP(totalXP: number): number`
- `calculateXPToNextLevel(currentLevel: number): number`

**EconomyService** (existing):
- `addCurrency(userId, currency, amount, sourceType, sourceId?, metadata?)` - For gold rewards

**AnalyticsService** (existing):
- Event logging for `xp_gained`, `level_up`, `level_reward_claimed`

### Combat System Integration

The combat system should call the internal XP award endpoint:

```typescript
// In CombatController.completeCombat()
if (result === 'victory') {
  await progressionController.awardExperience({
    user_id: userId,
    xp_amount: 50, // Base combat XP
    source: 'combat',
    source_id: sessionId,
    metadata: { enemy_type: enemyType, location_id: locationId }
  });
}
```

---

## Testing Considerations

### Unit Tests Required

1. **Controller Tests:**
   - Authentication validation
   - Request validation (Zod schemas)
   - Success response structures
   - Error handling for all error codes
   - Service method call verification

2. **Integration Tests:**
   - Full progression flow (XP award → level up → reward claim)
   - Double-claiming prevention
   - Level requirement validation
   - Database transaction atomicity

3. **Edge Cases:**
   - XP overflow scenarios
   - Level 50+ progression (prestige boundary)
   - Concurrent reward claiming
   - Invalid/corrupted progression data

### Test Data Setup

- Test users at various levels (1, 5, 10, 49, 50)
- Sample level rewards (claimable and automatic)
- XP amounts that trigger level-ups
- Edge case progression states

---

## Related Documentation

- [F-08 XP Progression System](../feature-specs/F-08-xp-progression-system.yaml) - Core feature specification
- [PlayerProgression Schema](../data-plan.yaml#L351-361) - Database schema
- [XP Analytics Events](../data-plan.yaml#L290-300) - Event tracking
- [System Design](../system-design.yaml) - Architecture overview
- [EconomyController Spec](./EconomyController.md) - Related currency operations

---

## Implementation Notes

### XP Calculation Formulas

**XP to Next Level:** `100 * current_level`
- Level 1→2: 100 XP (2 combat victories)
- Level 5→6: 500 XP (10 combat victories)
- Level 10→11: 1,000 XP (20 combat victories)

**Total XP for Level:** Cumulative sum
- Level 5: 1,000 XP total
- Level 10: 4,500 XP total
- Level 50: 122,500 XP total


---

## Future Enhancements

- **Prestige System Integration (F-13):** Level 50+ progression unlock
- **Achievement XP Bonuses:** Additional XP sources beyond combat
- **Weekly/Event Multipliers:** Temporary XP boosts
- **Social Features:** Progression leaderboards and comparisons
- **Push Notifications:** Level-up and reward availability alerts

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- ProgressionService (NEW - needs creation for XP progression, level calculations, and level reward claiming)
- EconomyService (existing - for reward transactions)
- AnalyticsService (existing - for event tracking)

### Dependents
**Controllers that use this controller:**
- **CombatController** (awards XP through internal /progression/award-xp endpoint)
- **QuestController** (future - will award XP for quest completions)

### Related Features
- **F-08 XP Progression System** - Primary feature spec
- **F-02 Combat System** - XP awards from combat victories
- **F-13 Progression Endgame** - Prestige system integration for level 50+

### Data Models
- PlayerProgression table (docs/data-plan.yaml:605-626)
- LevelRewards table (seed data for reward definitions)
- UserLevelRewards table (claimed rewards tracking)

### Integration Notes
- **XP Award Integration**: Combat system calls internal XP award endpoint for combat victories
- **Reward Currency**: Gold rewards processed through EconomyService for transaction logging
- **Level Calculation**: Uses exponential XP formula - 100 × current_level for next level
- **Internal API**: Provides /award-xp endpoint for service-to-service XP attribution