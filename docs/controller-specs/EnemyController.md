# EnemyController Specification

## Controller Overview

**Purpose:** Handles enemy-related endpoints for the combat system, specifically supporting the Enemy AI Personality System (F-12) by providing enemy type data and player combat history tracking.

**Responsibility:** Serves as the API gateway for enemy personality traits, combat statistics, and location-specific player performance data required for AI-generated enemy chatter during combat encounters.

**Feature References:**
- **Primary:** F-12 Enemy AI Personality System
- **Integration:** F-02 Combat System, F-01 Geolocation, F-11 Pet Personality System (shared AI infrastructure)

**Service Dependencies:**
- **Direct:** Supabase client (database queries only - no dedicated service layer)
- **Indirect:** EnemyChatterService (future integration for POST /combat/enemy-chatter)
- **Related:** CombatService (for combat session management)

**Current Status:** Partially implemented - Core endpoints exist but missing enemy chatter generation endpoint

---

## Endpoint: GET /enemies/types

### Route Definition
- **Path:** `/enemies/types`
- **Method:** GET
- **Handler:** `EnemyController.getEnemyTypes`
- **File Reference:** `mystica-express/src/controllers/EnemyController.ts:19-44`

### Authentication & Middleware
- **Authentication:** Not required (public endpoint)
- **Middleware Chain:** Standard Express stack only
- **Validation:** None required (no input parameters)

### Input Schema
**Headers:** Standard HTTP headers
**Parameters:** None
**Query Parameters:** None
**Request Body:** None

### Output Schema

#### Success Response (200)
```typescript
{
  enemy_types: Array<{
    id: string;                           // UUID
    name: string;                         // "Spray Paint Goblin", "Goopy Floating Eye"
    ai_personality_traits: string[];      // ["arrogant", "street-smart", "artistic"]
    dialogue_tone: string;                // "aggressive" | "sarcastic" | "condescending" | "chaotic" | "political"
    verbosity: string;                    // "terse" | "moderate" | "verbose"
    example_taunts: string[];             // ["Too slow!", "Call that art?"]
    base_dialogue_prompt: string;         // AI system prompt template
  }>
}
```

#### Error Responses

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database query error"
  }
}
```

### Database Operations
**Query:** Supabase select from `enemytypes` table
```sql
SELECT id, name, ai_personality_traits, dialogue_tone, verbosity, example_taunts, base_dialogue_prompt
FROM enemytypes
ORDER BY name
```

**Table Schema Reference:** `docs/data-plan.yaml:622-644`

### Business Logic Flow
1. Query enemytypes table for all enemy personality data
2. Return ordered results by name
3. Handle database errors via Express error middleware

### Related Documentation
- **API Contract:** `docs/api-contracts.yaml:1877-1892`
- **Feature Spec:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml:134-167`
- **Data Schema:** `docs/data-plan.yaml:622-644`

---

## Endpoint: GET /players/combat-history/:location_id

### Route Definition
- **Path:** `/players/combat-history/:location_id`
- **Method:** GET
- **Handler:** `EnemyController.getPlayerCombatHistory`
- **File Reference:** `mystica-express/src/controllers/EnemyController.ts:51-115`

### Authentication & Middleware
- **Authentication:** Required (JWT via auth middleware)
- **Middleware Chain:**
  1. Auth middleware (attaches `req.user`)
  2. Route validation (validates `location_id` UUID param)
- **User Context:** `req.user.id` for player identification

### Input Schema

#### Route Parameters
```typescript
// Zod Schema: LocationIdParamsSchema (schemas.ts:48-50)
{
  location_id: string; // UUID format required
}
```

#### Validation Reference
- **Schema:** `mystica-express/src/types/schemas.ts:48-50`
- **Type:** `LocationIdParams`

### Output Schema

#### Success Response (200)
```typescript
{
  location_id: string;           // UUID - requested location
  attempts: number;              // total_attempts from database
  victories: number;             // victories count
  defeats: number;               // defeats count
  win_rate: number;              // calculated: victories/attempts (3 decimal precision)
  current_streak: number;        // consecutive wins (resets on loss)
  longest_streak: number;        // best streak ever at this location
  last_attempt: string | null;  // ISO timestamp or null for new players
}
```

#### Error Responses

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
    code: "LOCATION_NOT_FOUND",
    message: "Location not found"
  }
}
```

**500 Internal Server Error:**
```typescript
{
  error: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Database query error"
  }
}
```

### Database Operations

#### Location Validation Query
```sql
SELECT id FROM locations WHERE id = $location_id LIMIT 1
```

#### Combat History Query
```sql
SELECT * FROM playercombathistory
WHERE user_id = $user_id AND location_id = $location_id
LIMIT 1
```

**Table Schema Reference:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml:73-83`

### Business Logic Flow
1. **Authentication Check:** Verify `req.user.id` exists (401 if missing)
2. **Location Validation:** Confirm location exists in database (404 if not found)
3. **History Lookup:** Query playercombathistory for user + location combination
4. **New Player Handling:** Return zeroed stats if no history record exists (PGRST116 error code)
5. **Win Rate Calculation:** `victories / total_attempts` rounded to 3 decimals
6. **Response Assembly:** Map database fields to API response format

### Edge Cases
- **First-time players:** Returns zeroed stats with `attempts: 0`, `win_rate: 0`
- **Division by zero:** Win rate calculation handles zero attempts gracefully
- **Missing location:** Validates location existence before querying history

### Related Documentation
- **API Contract:** `docs/api-contracts.yaml:169-185` (inferred from F-12 spec)
- **Feature Spec:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml:169-185`
- **Auth Middleware:** `mystica-express/src/middleware/auth.ts`

---

## Missing Endpoint: POST /combat/enemy-chatter

### Implementation Status
**Status:** Not implemented (referenced in F-12 spec but missing from controller)

### Required Integration
- **Endpoint:** `POST /combat/enemy-chatter`
- **Purpose:** Generate AI-powered enemy trash-talk during combat events
- **Service Dependency:** Requires EnemyChatterService implementation
- **AI Integration:** OpenAI GPT-4.1-nano for dynamic dialogue generation

### Input Schema (Proposed)
```typescript
// Schema: EnemyChatterRequestSchema (schemas.ts:160-174)
{
  session_id: string;                    // UUID - combat session ID
  event_type: "combat_start" | "player_hit" | "player_miss" |
             "enemy_hit" | "low_player_hp" | "near_victory" |
             "defeat" | "victory";
  event_details: {
    damage?: number;                     // non-negative integer
    accuracy?: number;                   // 0.0 to 1.0
    is_critical?: boolean;
    turn_number: number;                 // positive integer
    player_hp_pct: number;              // 0.0 to 1.0
    enemy_hp_pct: number;               // 0.0 to 1.0
  }
}
```

### Expected Output Schema
```typescript
{
  dialogue: string;                      // AI-generated trash-talk
  enemy_type: string;                    // enemy type identifier
  dialogue_tone: string;                 // personality tone used
  generation_time_ms: number;           // AI latency measurement
  player_context_used: {
    attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
  }
}
```

### Implementation Requirements
- **Combat Session Lookup:** Redis/database query for enemy type and combat state
- **Player History Integration:** Use existing `getPlayerCombatHistory` logic
- **AI Service Integration:** OpenAI API calls with personality-specific prompts
- **Fallback Handling:** Use `example_taunts` if AI service fails (timeout >2s)
- **Analytics Logging:** Insert to `enemy_chatter_log` table for metrics

### Related Documentation
- **Feature Spec:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml:99-133`
- **AI Flow Diagram:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml:187-215`
- **Schema Definition:** `mystica-express/src/types/schemas.ts:160-174`

---

## Controller Dependencies

### Database Tables
- **enemytypes:** Personality traits and AI prompt templates
- **playercombathistory:** Player performance tracking per location
- **locations:** Location validation for combat history
- **enemy_chatter_log:** Analytics for AI-generated dialogue (future)

### External Services
- **Supabase:** PostgreSQL database queries
- **OpenAI API:** GPT-4.1-nano for enemy chatter generation (future)
- **Redis:** Combat session state management (future)

### Type Definitions
- **Database Types:** `mystica-express/src/types/database.types.ts:6-7`
- **Request Schemas:** `mystica-express/src/types/schemas.ts:48-50, 160-174`
- **Express Extensions:** `mystica-express/src/types/express.d.ts`

---

## Error Handling

### Express Error Middleware
All endpoints use `next(error)` pattern for centralized error handling via `mystica-express/src/middleware/errorHandler.ts`

### Database Error Patterns
- **PGRST116:** "No rows returned" - Normal for new players (combat history)
- **Connection errors:** 500 Internal Server Error response
- **Constraint violations:** 400 Bad Request (validation failures)

### Authentication Errors
- **Missing JWT:** 401 Unauthorized
- **Invalid JWT:** 401 Unauthorized (handled by auth middleware)
- **Missing user context:** 401 Authentication required

---

## Testing Requirements

### Unit Test Coverage
- **Mock Supabase client:** Test database query handling
- **Authentication scenarios:** Valid/invalid JWT tokens
- **Error conditions:** Database failures, missing data
- **Edge cases:** New players, invalid UUIDs

### Integration Test Scenarios
- **Enemy types retrieval:** Verify complete personality data
- **Combat history tracking:** Multi-location player scenarios
- **Location validation:** Existing vs non-existent locations

### Test File Location
- **Proposed:** `mystica-express/tests/unit/controllers/EnemyController.test.ts`
- **Pattern:** Follow existing controller test patterns in codebase

---

## Future Enhancements

### AI Chatter Integration
- **Implementation:** EnemyChatterService with OpenAI integration
- **Analytics:** Track dialogue quality and generation performance
- **Personalization:** Enemy personality evolution based on player skill

### Real-time Features
- **WebSocket support:** Live enemy chatter during combat
- **Combat session management:** Redis-based state tracking
- **Event streaming:** Real-time combat event processing

### Performance Optimization
- **Response caching:** Enemy types with Redis
- **Database views:** Pre-computed combat statistics
- **Connection pooling:** Optimized Supabase connections

## Cross-References

### Dependencies
**Controllers this controller depends on:**
- **AuthController** (requires authenticated users via auth middleware)

**Services used:**
- EnemyChatterService (AI-generated enemy trash-talk for F-12)
- EconomyService (for combat history retrieval)

### Dependents
**Controllers that use this controller:**
- **CombatController** (uses EnemyChatterService for enemy dialogue during combat)

### Related Features
- **F-12 Enemy AI Personality System** - Primary feature spec for AI-generated enemy personalities
- **F-02 Combat System** - Enemy encounters and personality-based dialogue
- **F-01 Geolocation & Map** - Location-based enemy pools and personality context

### Data Models
- EnemyTypes table (personality traits and AI prompt templates)
- PlayerCombatHistory table (player performance tracking per location)
- Locations table (location validation for combat history)
- Enemy_chatter_log table (analytics for AI-generated dialogue)

### Integration Notes
- **Combat Integration**: EnemyChatterService used by CombatController for enemy trash-talk during combat
- **Player History**: Uses existing combat history logic for AI context generation
- **AI Service Integration**: Future OpenAI API integration with personality-specific prompts
- **Fallback Handling**: Uses example_taunts when AI service fails or times out