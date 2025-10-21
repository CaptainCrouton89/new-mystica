# CombatController Specification

**Template:** `~/.claude/file-templates/init-project/controller-specs/controller-title.md`
**Status:** `in-progress`
**Last Updated:** 2025-01-27

## Controller Overview

### Purpose and Responsibility
The `CombatController` handles all combat-related HTTP endpoints for Mystica's turn-based combat system. It manages combat session lifecycle, weapon timing mechanics, and AI-powered dialogue generation for both pets and enemies during combat events.

### Feature References
- **F-02 Combat System** - Core turn-based combat with weapon timing dial mechanics
- **F-11 Pet Personality System** - AI-generated pet dialogue during combat events
- **F-12 Enemy AI Personality System** - AI-generated enemy trash-talk during combat

### Service Dependencies
- **CombatService** (`../services/CombatService.js`) - Core combat logic, session management, damage calculation
- **ChatterService** (`../services/ChatterService.js`) - Pet personality dialogue generation (F-11)
- **EnemyChatterService** (`../services/EnemyChatterService.js`) - Enemy AI trash-talk generation (F-12)
- **CombatStubService** (`../services/CombatStubService.js`) - Temporary stub for combat session validation

### File Location
`mystica-express/src/controllers/CombatController.ts`

---

## Endpoints Specification

### 1. POST /combat/start - Initialize Combat Session

**Route:** `POST /api/v1/combat/start`
**Handler:** `CombatController.startCombat`
**Feature:** F-02 Combat System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (StartCombatSchema from schemas.ts:79-81)
{
  "location_id": "uuid"  // UUID of location where combat is initiated
}
```

#### Output Schema (Success - 201)
```typescript
{
  "session_id": "uuid",
  "enemy": {
    "id": "uuid",
    "type": "string",           // Enemy type name
    "atk": "number",           // Attack stat (tier-scaled)
    "def": "number",           // Defense stat (tier-scaled)
    "hp": "number",            // Max HP (tier-scaled)
    "style_id": "uuid"         // Determines reward material style
  },
  "player_stats": {
    "atk": "number",           // From equipped items + pet
    "def": "number",           // From equipped items + pet
    "hp": "number"             // From equipped items + pet
  },
  "weapon_config": {
    "pattern": "single_arc",   // MVP0: Always single_arc
    "spin_deg_per_s": "number", // Constant speed for MVP0
    "adjusted_bands": {        // Accuracy-scaled hit zones
      "deg_injure": "number",
      "deg_miss": "number",
      "deg_graze": "number",
      "deg_normal": "number",
      "deg_crit": "number"
    }
  }
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid location_id format"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "NOT_FOUND",
    message: "Location not found or no enemy available at location"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database or service errors"
  }
}
```

#### Service Method Calls
```typescript
// From CombatController.ts:23
const combatSession = await combatService.startCombat(userId, location_id);
```

#### Middleware Chain
1. **Auth Middleware** - Validates JWT, sets `req.user`
2. **Validation Middleware** - Validates request body against `StartCombatSchema`
3. **Route Handler** - `CombatController.startCombat`

#### Business Logic Flow
1. Extract `location_id` from validated request body
2. Get `userId` from authenticated user (`req.user!.id`)
3. Call `combatService.startCombat(userId, location_id)` which:
   - Validates location exists and has available enemies
   - Selects enemy from appropriate pool based on location attributes
   - Loads player's equipped weapon and calculates stats
   - Creates ephemeral combat session (Redis, 15min TTL)
   - Calculates accuracy-adjusted hit bands via `fn_weapon_bands_adjusted()`
4. Return combat session data with enemy, player stats, and weapon config

---

### 2. POST /combat/attack - Execute Player Attack

**Route:** `POST /api/v1/combat/attack`
**Handler:** `CombatController.attack`
**Feature:** F-02 Combat System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (AttackSchema from schemas.ts:83-86)
{
  "session_id": "uuid",                    // Active combat session
  "tap_position_degrees": "number"         // 0-360, player's tap position on dial
}
```

#### Output Schema (Success - 200)
```typescript
{
  "hit_zone": "injure" | "miss" | "graze" | "normal" | "crit",
  "base_multiplier": "number",             // Zone-based multiplier
  "crit_bonus_multiplier": "number",       // 0-1.0, only present if crit
  "damage_dealt": "number",               // Damage to enemy
  "player_hp_remaining": "number",        // Player HP after enemy counterattack
  "enemy_hp_remaining": "number",         // Enemy HP after player attack
  "enemy_damage": "number",               // Damage taken from enemy counterattack
  "combat_status": "ongoing" | "victory" | "defeat"
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid session_id or tap_position_degrees (must be 0-360)"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Combat session not found or expired (15min TTL)"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database or calculation errors"
  }
}
```

#### Service Method Calls
```typescript
// From CombatController.ts:40
const attackResult = await combatService.executeAttack(session_id, tap_position_degrees);
```

#### Middleware Chain
1. **Auth Middleware** - Validates JWT, sets `req.user`
2. **Validation Middleware** - Validates request body against `AttackSchema`
3. **Route Handler** - `CombatController.attack`

#### Business Logic Flow
1. Extract `session_id` and `tap_position_degrees` from validated request
2. Call `combatService.executeAttack(session_id, tap_position_degrees)` which:
   - Validates combat session exists and is active
   - Determines hit zone by comparing tap position to accuracy-adjusted bands
   - Applies zone multiplier: injure=-50%, miss=0%, graze=60%, normal=100%, crit=160%+RNG
   - Calculates damage: `(player_ATK * total_multiplier) - enemy_DEF` (min 1)
   - Processes enemy counterattack: `enemy_ATK - player_DEF` (min 1)
   - Updates session state (HPs, turn count)
   - Returns attack result with hit zone feedback
3. Return attack result for client UI updates

#### Related Documentation
- F-02 Combat System spec: Zone multipliers (lines 129-134)
- Database: `fn_weapon_bands_adjusted()` function for hit zone calculation
- API contracts: `/combat/attack` (lines 958-996)

---

### 3. POST /combat/defend - Execute Player Defense

**Route:** `POST /api/v1/combat/defend`
**Handler:** `CombatController.defend` *(NOT YET IMPLEMENTED)*
**Feature:** F-02 Combat System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (DefenseSchema from schemas.ts:88-91)
{
  "session_id": "uuid",
  "defense_accuracy": "number"             // 0.0-1.0, how close tap was to dial center
}
```

#### Output Schema (Success - 200)
```typescript
{
  "damage_blocked": "number",              // Damage prevented by successful defense
  "damage_taken": "number",               // Damage player actually received
  "player_hp_remaining": "number",        // Player HP after defense
  "combat_status": "ongoing" | "victory" | "defeat"
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid session_id or defense_accuracy (must be 0.0-1.0)"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Combat session not found or expired"
  }
}
```

**501 Not Implemented:**
```typescript
{
  error: {
    code: "NOT_IMPLEMENTED",
    message: "Handler not yet implemented"
  }
}
```

#### Service Method Calls
```typescript
// Future implementation
const defenseResult = await combatService.executeDefense(session_id, defense_accuracy);
```

#### Implementation Status
**NOT YET IMPLEMENTED** - Handler missing from CombatController.ts. Requires:
1. Add `defend` method to CombatController class
2. Implement `executeDefense` method in CombatService
3. Add route registration in combat routes

---

### 4. POST /combat/complete - Finalize Combat and Claim Rewards

**Route:** `POST /api/v1/combat/complete`
**Handler:** `CombatController.completeCombat`
**Feature:** F-02 Combat System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (CompleteCombatSchema from schemas.ts:93-96)
{
  "session_id": "uuid",
  "result": "victory" | "defeat"
}
```

#### Output Schema (Success - 200)
```typescript
{
  "result": "victory" | "defeat",
  "rewards": {
    "materials": [
      {
        "material_id": "string",
        "style_id": "uuid",              // Matches enemy's style_id for styled enemies
        "quantity": "number"
      }
    ],
    "items": [                           // Only on victory
      {
        "item_id": "uuid",
        "type": "string",
        "stats": "object"
      }
    ]
  },
  "updated_balance": {
    "gold": "number",
    "materials": [
      {
        "material_id": "string",
        "style_id": "uuid",
        "quantity": "number"             // New total quantity
      }
    ]
  }
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid session_id or result value"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Combat session not found"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Reward generation or database errors"
  }
}
```

#### Service Method Calls
```typescript
// From CombatController.ts:57
const combatRewards = await combatService.completeCombat(session_id, result);
```

#### Middleware Chain
1. **Auth Middleware** - Validates JWT, sets `req.user`
2. **Validation Middleware** - Validates request body against `CompleteCombatSchema`
3. **Route Handler** - `CombatController.completeCombat`

#### Business Logic Flow
1. Extract `session_id` and `result` from validated request
2. Call `combatService.completeCombat(session_id, result)` which:
   - Validates combat session exists and is in completed state
   - On victory: Generates rewards from LootPools based on enemy tier/type
   - On victory: Materials inherit enemy's style_id (styled enemies drop styled materials)
   - Updates player material stacks and currency balances
   - Logs combat result to player combat history
   - Cleans up ephemeral session data
3. Return rewards and updated balances

#### Related Documentation
- F-02 Combat System: Style system integration (line 177)
- Database: LootPools and LootPoolEntries for reward generation
- API contracts: `/combat/complete` (lines 1036-1074)

---

### 5. POST /combat/pet-chatter - Generate Pet Dialogue

**Route:** `POST /api/v1/combat/pet-chatter`
**Handler:** `CombatController.generatePetChatter` *(NOT YET IMPLEMENTED)*
**Feature:** F-11 Pet Personality System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (PetChatterSchema from schemas.ts:145-157)
{
  "session_id": "uuid",
  "event_type": "player_attack" | "player_defense" | "enemy_attack" | "enemy_defense" |
                "critical_hit" | "miss" | "victory" | "defeat",
  "event_details": {                     // Optional
    "damage": "number",                  // Optional
    "accuracy": "number",                // Optional
    "is_critical": "boolean",            // Optional
    "turn_number": "number"              // Optional
  }
}
```

#### Output Schema (Success - 200)
```typescript
{
  "success": true,
  "dialogue_response": {
    "text": "string",                      // AI-generated pet dialogue
    "personality_type": "sassy" | "encouraging" | "analytical" | "chaotic" | "stoic" | "trash_talker",
    "custom_pet_name": "string",         // Player-assigned pet name (nullable)
    "generation_time_ms": "number"
  },
  "cached": false                        // Always false for real-time generation
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid event_type or malformed event_details"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Combat session not found or no pet equipped"
  }
}
```

**503 Service Unavailable:**
```typescript
{
  error: {
    code: "AI_SERVICE_UNAVAILABLE",
    message: "AI service temporarily unavailable (fallback to canned phrases)"
  }
}
```

#### Service Method Calls
```typescript
// Future implementation
const dialogueResponse = await chatterService.generateDialogue(
  session_id,
  event_type,
  event_details
);
```

#### Middleware Chain
1. **Auth Middleware** - Validates JWT, sets `req.user`
2. **Validation Middleware** - Validates request body against `PetChatterSchema`
3. **Route Handler** - `CombatController.generatePetChatter`

#### Business Logic Flow
1. Extract `session_id`, `event_type`, and `event_details` from validated request
2. Validate combat session exists and user has pet equipped
3. Call `chatterService.generateDialogue()` which:
   - Retrieves pet personality from `player_pet_personalities` table
   - Constructs AI prompt using personality traits and combat context
   - Calls OpenAI/GPT service for dialogue generation
   - Logs generated dialogue to `combat_chatter_log` for analytics
4. Return generated dialogue with personality metadata

#### Implementation Status
**NOT YET IMPLEMENTED** - Handler missing from CombatController.ts. Requires:
1. Add `generatePetChatter` method to CombatController class
2. Import and integrate ChatterService
3. Add route registration in combat routes

#### Related Documentation
- F-11 Pet Personality System spec: Personality traits and dialogue styles
- API contracts: `/combat/pet-chatter` (lines 1717-1761)

---

### 6. POST /combat/enemy-chatter - Generate Enemy Trash-Talk

**Route:** `POST /api/v1/combat/enemy-chatter`
**Handler:** `CombatController.generateEnemyChatter`
**Feature:** F-12 Enemy AI Personality System

#### Input Schema
```typescript
// Headers
Authorization: Bearer <jwt_token>  // Required via auth middleware

// Request Body (EnemyChatterRequestSchema from schemas.ts:160-174)
{
  "session_id": "uuid",
  "event_type": "combat_start" | "player_hit" | "player_miss" | "enemy_hit" |
                "low_player_hp" | "near_victory" | "defeat" | "victory",
  "event_details": {
    "damage": "number",                  // Non-negative, optional
    "accuracy": "number",                // 0.0-1.0, optional
    "is_critical": "boolean",            // Optional
    "turn_number": "number",             // Positive integer, required
    "player_hp_pct": "number",           // 0.0-1.0, required
    "enemy_hp_pct": "number"             // 0.0-1.0, required
  }
}
```

#### Output Schema (Success - 200)
```typescript
{
  "success": true,
  "dialogue_response": {
    "text": "string",                      // AI-generated enemy dialogue
    "enemy_type": "string",             // Enemy type (spray_paint_goblin, etc.)
    "dialogue_tone": "aggressive" | "sarcastic" | "condescending" | "chaotic" | "political",
    "generation_time_ms": "number"
  },
  "cached": false                        // Always false for real-time generation
}
```

#### Error Responses

**400 Bad Request:**
```typescript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid event_type, missing required fields, or validation errors"
  }
}
```

**401 Unauthorized:**
```typescript
{
  error: {
    code: "UNAUTHORIZED",
    message: "Missing or invalid JWT token"
  }
}
```

**404 Not Found:**
```typescript
{
  error: {
    code: "SESSION_NOT_FOUND",
    message: "Combat session not found or expired"
  }
}
```

**503 Service Unavailable:**
```typescript
{
  error: {
    code: "AI_SERVICE_UNAVAILABLE",
    message: "AI dialogue generation service temporarily unavailable"
  }
}
```

#### Service Method Calls
```typescript
// From CombatController.ts:80, 115-119
// Session validation
const combatSession = await combatStubService.getCombatSession(session_id);

// Dialogue generation
const dialogueResponse = await enemyChatterService.generateDialogue(
  session_id,
  event_type,
  combatEventDetails
);
```

#### Middleware Chain
1. **Auth Middleware** - Validates JWT, sets `req.user`
2. **Validation Middleware** - Validates request body against `EnemyChatterRequestSchema`
3. **Route Handler** - `CombatController.generateEnemyChatter`

#### Business Logic Flow
1. Extract `session_id`, `event_type`, and `event_details` from validated request
2. Validate combat session exists using `combatStubService.getCombatSession()`
3. Convert request format to internal `CombatEventDetails` format:
   - Convert HP percentages from 0.0-1.0 to 0-100 scale
   - Set default values for optional damage/accuracy fields
4. Call `enemyChatterService.generateDialogue()` with converted data
5. Handle AI service failures gracefully:
   - Return 503 status with structured error for `ExternalAPIError`
   - Include service unavailability message and error details
6. Return generated dialogue response

#### Special Error Handling
The controller implements specific error handling for AI service failures:

```typescript
// From CombatController.ts:120-133
catch (error) {
  if (error instanceof ExternalAPIError) {
    res.status(503).json({
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'AI dialogue generation service is temporarily unavailable',
        details: error.message
      }
    });
    return;
  }
  throw error;
}
```

#### Data Transformation
The controller performs data transformation between API and service formats:

```typescript
// From CombatController.ts:103-110
const combatEventDetails: CombatEventDetails = {
  damage: damage || 0,
  accuracy: accuracy || 0,
  is_critical: is_critical || false,
  turn_number,
  player_hp_percentage: player_hp_pct * 100, // Convert 0.0-1.0 to 0-100
  enemy_hp_percentage: enemy_hp_pct * 100,   // Convert 0.0-1.0 to 0-100
};
```

#### Related Documentation
- F-12 Enemy AI Personality System spec: Enemy types and dialogue tones
- API contracts: `/combat/enemy-chatter` (lines 1826-1874)
- Service: EnemyChatterService implementation

---

## Common Middleware Chain

All combat endpoints use a consistent middleware chain:

### 1. CORS Middleware
- Applied globally in `app.ts:25`
- Handles cross-origin requests for web clients

### 2. Body Parsing Middleware
- Applied globally in `app.ts:33-34`
- Parses JSON request bodies with size limits

### 3. Auth Middleware
- File: `middleware/auth.ts`
- Validates JWT tokens via Supabase auth
- Sets `req.user` with authenticated user data
- **Known Issue:** Currently uses `null as unknown as SupabaseClient` placeholder

### 4. Validation Middleware
- File: `middleware/validate.ts`
- Validates request bodies against Zod schemas from `schemas.ts`
- Sets `req.validated` with type-safe validated data
- Returns 400 errors for validation failures

### 5. Route Handler
- Individual CombatController methods
- Access authenticated user via `req.user!.id`
- Access validated data via `req.validated` or destructured `req.body`

### 6. Error Handler
- File: `errorHandler.ts`
- Catches thrown errors and converts to structured HTTP responses
- Handles NotFoundError (404), ValidationError (400), ExternalAPIError (503)

---

## Implementation Status

### Completed Components
- ✅ **startCombat** - Full implementation with CombatService integration
- ✅ **attack** - Full implementation with damage calculation and session updates
- ✅ **completeCombat** - Full implementation with reward generation
- ✅ **generateEnemyChatter** - Full implementation with AI service integration

### Missing Components
- ❌ **defend** - Handler method not implemented, route missing
- ❌ **generatePetChatter** - Handler method not implemented, requires ChatterService integration

### Known Issues
- **Auth middleware placeholder:** Uses `null as unknown as SupabaseClient` (lines 44, 104 in middleware/auth.ts)
- **CombatStubService dependency:** Enemy chatter uses stub service for session validation instead of full CombatService
- **Missing route registration:** Pet chatter and defend endpoints need route definitions

### Next Steps
1. Implement missing `defend` and `generatePetChatter` handler methods
2. Add route registrations for missing endpoints
3. Fix auth middleware Supabase client initialization
4. Replace CombatStubService with full CombatService integration
5. Add comprehensive error handling for all edge cases

---

## Type Definitions

### Request Types (from schemas.ts)
```typescript
export type StartCombatRequest = z.infer<typeof StartCombatSchema>;
export type AttackRequest = z.infer<typeof AttackSchema>;
export type DefenseRequest = z.infer<typeof DefenseSchema>;
export type CompleteCombatRequest = z.infer<typeof CompleteCombatSchema>;
export type PetChatterRequest = z.infer<typeof PetChatterSchema>;
export type EnemyChatterRequest = z.infer<typeof EnemyChatterRequestSchema>;
```

### Service Response Types (from services)
```typescript
// CombatService responses
interface CombatSession { session_id: string; enemy: object; player_stats: object; }
interface AttackResult { hit_zone: HitBand; damage_dealt: number; /* ... */ }
interface CombatRewards { result: string; rewards: object; updated_balance: object; }

// ChatterService responses
interface DialogueResponse { text: string; personality_type: string; /* ... */ }
```

### Database Enums
```typescript
type CombatResult = 'victory' | 'defeat';
type HitBand = 'injure' | 'miss' | 'graze' | 'normal' | 'crit';
type WeaponPattern = 'single_arc' | 'dual_arcs' | 'pulsing_arc' | 'roulette' | 'sawtooth';

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)
- **LocationController** (depends on location data for combat spawn points)

**Services used:**
- CombatService (core combat logic, session management, damage calculation)
- ChatterService (pet personality dialogue generation for F-11)
- EnemyChatterService (enemy AI trash-talk generation for F-12)
- CombatStubService (temporary stub for combat session validation)

### Dependents
**Controllers that use this controller:**
- **ProgressionController** (receives XP awards from combat victories)
- **EconomyController** (receives currency transactions from combat rewards)
- **MaterialController** (indirectly - materials are dropped from combat via F-05)

### Related Features
- **F-02 Combat System** - Primary feature spec for turn-based combat
- **F-11 Pet Personality System** - AI-generated pet dialogue during combat events
- **F-12 Enemy AI Personality System** - AI-generated enemy trash-talk during combat
- **F-01 Geolocation & Map** - Location data feeds combat encounters
- **F-05 Material Drop System** - Combat rewards include material drops

### Data Models
- CombatSessions table (docs/data-plan.yaml:685-695)
- CombatActions table (docs/data-plan.yaml:697-714)
- Locations table (docs/data-plan.yaml:657-667)
- EnemyPools, LootPools (for combat encounters and rewards)

### Integration Notes
- **Location Integration**: Uses LocationService to validate combat locations and spawn enemies
- **Progression System**: Awards XP through ProgressionController on combat victories
- **Economy Integration**: Rewards gold/gems through EconomyController transactions
- **AI Personality**: Generates contextual dialogue for pets and enemies during combat events
- **Material Drops**: Combat completion triggers material rewards via F-05 system
```