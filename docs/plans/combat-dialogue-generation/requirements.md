# Requirements: Enemy Combat Dialogue Generation (F-12 Backend)

## Overview
**Purpose:** Implement backend API endpoints for F-12 Enemy AI Personality System to generate dynamic, AI-powered trash-talk during combat encounters.

**User Benefit:** Creates engaging, memorable combat experiences with contextual enemy dialogue that responds to combat events, player history, and enemy personality traits.

**Problem:** Combat encounters lack personality and engagement. Static enemies without dialogue feel lifeless. This feature brings enemies to life with dynamic, personality-driven trash-talk that makes each encounter unique and entertaining.

**Related Documentation:**
- `docs/product-requirements.yaml` - F-12 Enemy AI Personality System definition
- `docs/feature-specs/F-12-enemy-ai-personality-system.yaml` - Complete technical specification
- `docs/api-contracts.yaml` - API endpoint definitions (lines 1725-1814)
- `docs/system-design.yaml` - Architecture and AI integration
- `docs/data-plan.md` - Database schema and analytics tracking
- `docs/plans/combat-dialogue-generation/investigations/f12-enemy-ai-current-state.md` - Current state analysis
- `docs/plans/combat-dialogue-generation/investigations/openai-integration-patterns.md` - AI integration patterns

### Edge Cases
- **Empty state:** No combat session exists → Return 404 with clear error message
- **Error state:** OpenAI API failure → Fallback to random `example_taunts` from database, mark `was_ai_generated: false`
- **Loading state:** AI generation takes 1-2s → Return response when ready (blocking), log `generation_time_ms`
- **Large dataset/performance:** Multiple rapid requests → Throttle to 1-2 messages per combat turn, log all attempts in `enemychatterlog` for analytics
- **Missing personality data:** Enemy type has no personality prompt → Use generic fallback prompt, log warning
- **First-time player:** No combat history at location → Return zeroed stats in response, taunt about being a newcomer

## Functional Requirements

### User Interactions
**Note:** This is backend-only implementation. Frontend interactions documented for context but not implemented in this phase.

1. Combat system triggers dialogue generation on specific events (player_hit, player_miss, enemy_hit, combat_start, etc.)
2. Backend generates personality-appropriate trash-talk using OpenAI GPT-4.1-nano
3. Backend returns dialogue to frontend for display in speech bubble above enemy sprite
4. Player views AI-generated enemy trash-talk during combat encounters
5. System logs all dialogue attempts for analytics and monitoring

### Data Requirements

#### Request Data (POST /combat/enemy-chatter)
**Fields:**
- `session_id`: UUID (required) - Combat session identifier
- `event_type`: string (required) - One of: `combat_start`, `player_hit`, `player_miss`, `enemy_hit`, `low_player_hp`, `near_victory`, `defeat`, `victory`
- `event_details`: object (required)
  - `damage`: integer (optional) - Damage dealt in event
  - `accuracy`: float (optional) - Attack accuracy (0.0-1.0)
  - `is_critical`: boolean (optional) - Whether attack was critical
  - `turn_number`: integer (required) - Current combat turn
  - `player_hp_pct`: float (required) - Player HP percentage (0.0-1.0)
  - `enemy_hp_pct`: float (required) - Enemy HP percentage (0.0-1.0)

**Validation:**
- `session_id` must be valid UUID format
- `event_type` must be one of 8 valid types
- `turn_number` must be positive integer
- HP percentages must be 0.0-1.0 range
- Damage must be non-negative if provided

**Relationships:**
- `session_id` → stubbed combat session (hardcoded for MVP)
- Combat session → enemy_type_id → `enemytypes` table
- Combat session → player_id + location_id → `playercombathistory` table

#### Response Data
**Fields:**
- `dialogue`: string - AI-generated trash-talk (1-2 sentences)
- `enemy_type`: string - Enemy type name (e.g., "Spray Paint Goblin")
- `dialogue_tone`: string - Tone from enemytypes (aggressive, sarcastic, condescending, chaotic, political)
- `generation_time_ms`: integer - AI generation latency
- `player_context_used`: object
  - `attempts`: integer - Total combat attempts at location
  - `victories`: integer - Total victories
  - `defeats`: integer - Total defeats
  - `current_streak`: integer - Current win/loss streak

### API Requirements

#### Endpoint 1: Generate Enemy Dialogue
**Endpoint:** `POST /api/v1/combat/enemy-chatter`
**Authentication:** Required (Bearer JWT)

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "player_hit",
  "event_details": {
    "damage": 45,
    "accuracy": 0.85,
    "is_critical": false,
    "turn_number": 3,
    "player_hp_pct": 0.65,
    "enemy_hp_pct": 0.40
  }
}
```

**Response (200 OK):**
```json
{
  "dialogue": "Ha! Call that a hit? I've been tickled harder by a feather!",
  "enemy_type": "Spray Paint Goblin",
  "dialogue_tone": "aggressive",
  "generation_time_ms": 850,
  "player_context_used": {
    "attempts": 5,
    "victories": 2,
    "defeats": 3,
    "current_streak": 0
  }
}
```

**Response (200 OK - AI Fallback):**
```json
{
  "dialogue": "Your defense is wack, like a toy tagger!",
  "enemy_type": "Spray Paint Goblin",
  "dialogue_tone": "aggressive",
  "generation_time_ms": 12,
  "was_ai_generated": false,
  "player_context_used": {
    "attempts": 5,
    "victories": 2,
    "defeats": 3,
    "current_streak": 0
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid `event_type` or malformed request
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid event_type. Must be one of: combat_start, player_hit, player_miss, enemy_hit, low_player_hp, near_victory, defeat, victory"
    }
  }
  ```
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Combat session not found
  ```json
  {
    "error": {
      "code": "COMBAT_SESSION_NOT_FOUND",
      "message": "Combat session 550e8400-e29b-41d4-a716-446655440000 not found or expired"
    }
  }
  ```
- `503 Service Unavailable`: OpenAI API completely down (after fallback exhausted)

#### Endpoint 2: List Enemy Types
**Endpoint:** `GET /api/v1/enemies/types`
**Authentication:** Not required (public endpoint)

**Response (200 OK):**
```json
{
  "enemy_types": [
    {
      "type": "spray_paint_goblin",
      "display_name": "Spray Paint Goblin",
      "personality_traits": ["street-smart urban artist", "sarcastic and witty", "tagging everything mid-combat"],
      "dialogue_tone": "aggressive",
      "verbosity": "moderate",
      "example_taunts": [
        "Your defense is wack, like a toy tagger!",
        "Gonna spray paint this L on your face!",
        "You call that a hit? My art hits harder!"
      ]
    },
    {
      "type": "goopy_floating_eye",
      "display_name": "Goopy Floating Eye",
      "personality_traits": ["all-seeing and ominous", "condescending observer", "dripping mysterious ooze"],
      "dialogue_tone": "condescending",
      "verbosity": "terse",
      "example_taunts": [
        "I see your pathetic attempts... amusing.",
        "Your movements are so predictable.",
        "Is that the best you can do? How... disappointing."
      ]
    }
  ]
}
```

**Errors:**
- `500 Internal Server Error`: Database connection failure

#### Endpoint 3: Get Player Combat History
**Endpoint:** `GET /api/v1/players/combat-history/:location_id`
**Authentication:** Required (Bearer JWT)

**Response (200 OK):**
```json
{
  "location_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "attempts": 5,
  "victories": 2,
  "defeats": 3,
  "win_rate": 0.40,
  "current_streak": 0,
  "longest_streak": 1,
  "last_attempt": "2025-10-19T14:32:00Z"
}
```

**Response (200 OK - First Time):**
```json
{
  "location_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "attempts": 0,
  "victories": 0,
  "defeats": 0,
  "win_rate": 0.0,
  "current_streak": 0,
  "longest_streak": 0,
  "last_attempt": null
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Location does not exist

### UI Requirements (if applicable)
**N/A - Backend only implementation.** Frontend integration notes:
- Dialogue displayed in speech bubble above enemy sprite
- 2-3 second auto-dismiss duration
- Chatter sound effect plays on display
- Queue multiple messages if rapid events

## Technical Requirements

### Performance
- **AI generation:** < 2000ms per request (GPT-4.1-nano target: 500-1500ms)
- **Database queries:** < 100ms for combat history lookup
- **Fallback response:** < 50ms if AI unavailable
- **Total endpoint response:** < 2500ms including AI generation
- **Throttling:** Maximum 1-2 dialogue requests per combat turn

### Security
- **Authentication:** JWT Bearer token validation via Supabase auth middleware
- **Authorization:** Players can only access their own combat history
- **Data protection:** Combat session validation prevents cross-player data leakage
- **Rate limiting:** 10 requests/minute per player to prevent dialogue spam abuse
- **Input sanitization:** Zod schema validation on all request bodies

### Integration Points
1. **OpenAI API (GPT-4.1-nano)**
   - Generate dynamic dialogue based on enemy personality and combat context
   - System prompt engineering using `base_dialogue_prompt` from database
   - Structured response with `generateObject()` from Vercel AI SDK
   - 2s timeout with fallback to `example_taunts`

2. **Supabase PostgreSQL**
   - `enemytypes` table: Enemy personality data (5 types already seeded)
   - `playercombathistory` table: Per-location combat statistics
   - `enemychatterlog` table: Analytics logging of all dialogue attempts
   - Database connection via `@supabase/supabase-js`

3. **Stubbed Combat System (F-02)**
   - `getCombatSession(session_id)` function returns hardcoded combat session object
   - Combat session includes: `enemy_type_id`, `player_id`, `location_id`, `turn_number`, `player_hp`, `enemy_hp`
   - Temporary implementation until F-02 is fully built

4. **Express.js Backend**
   - Route handlers in `src/routes/combat.ts` and `src/routes/enemies.ts`
   - Controllers in `src/controllers/CombatController.ts` and `src/controllers/EnemyController.ts`
   - Services in `src/services/EnemyChatterService.ts`
   - Middleware: Auth, validation, error handling

## Implementation Notes

### Existing patterns
**Follow OpenAI integration pattern:**
- `scripts/generate-item-description.ts:1-65` - Structured generation with Zod schemas
- `mystica-express/src/config/env.ts:24-27` - Environment variable validation
- `mystica-express/src/utils/errors.ts:142-153` - ExternalAPIError for AI failures

**Follow service layer pattern:**
- `mystica-express/src/services/LocationService.ts` - Complete reference implementation
- Class-based services with dependency injection
- Comprehensive error handling with custom error types

**Database query patterns:**
- Use Supabase client from `src/config/supabase.ts`
- Type-safe queries with `database.types.ts` generated types
- Error handling with try/catch and specific error messages

### Technology choices
- **AI Model:** GPT-4.1-nano via Vercel AI SDK (`@ai-sdk/openai`)
  - Reasoning: Cost-effective (~$0.0001/request), fast (<2s), sufficient for dialogue
  - Alternative: gpt-4.1-mini if nano unavailable
- **Validation:** Zod schemas in `src/types/schemas.ts`
  - Reasoning: Type-safe, runtime validation, clear error messages
- **Combat Session Stub:** Hardcoded TypeScript function
  - Reasoning: F-02 not implemented yet, need working endpoints for testing
  - Migration path: Replace stub with real Redis/database lookup when F-02 ready

### Error handling
**OpenAI API Failure:**
1. Try generateObject() with 2s timeout
2. On timeout/error: Log warning, select random `example_taunt` from database
3. Return fallback dialogue with `was_ai_generated: false`
4. Log attempt in `enemychatterlog` regardless of AI success

**Combat Session Not Found:**
1. Validate session_id format (UUID)
2. Call stubbed `getCombatSession()` function
3. If returns null: throw `NotFoundError` with 404 status
4. Return clear error message to client

**Database Connection Failure:**
1. Catch Supabase client errors
2. Throw `DatabaseError` with 500 status
3. Log error details for debugging
4. Return generic error to client (don't expose internals)

**Invalid Request Data:**
1. Zod schema validation catches malformed requests
2. Return 400 Bad Request with specific field errors
3. Use validation middleware pattern from existing endpoints

## Out of Scope
- F-02 Combat System implementation (using stub instead)
- F-11 Pet Personality System (separate feature, implement later)
- Frontend UI implementation (speech bubbles, sound effects)
- Real-time dialogue streaming (blocking request/response only)
- Voice synthesis for enemy dialogue
- Multilingual dialogue support
- A/B testing different personality prompts
- Player ability to customize enemy personalities
- Dialogue moderation/filtering system
- Redis combat session management (stubbed for now)
- Combat event triggering logic (frontend responsibility)
- Personality unlock/progression system

## Success Criteria
- [x] Database has all 5 enemy types with personality data (already complete)
- [ ] POST /combat/enemy-chatter generates AI dialogue in <2s
- [ ] Fallback system works when OpenAI unavailable (<50ms response)
- [ ] GET /enemies/types returns all enemy personality data
- [ ] GET /players/combat-history returns accurate stats
- [ ] All dialogue attempts logged to enemychatterlog
- [ ] Zod validation prevents malformed requests
- [ ] Authentication middleware protects endpoints
- [ ] Error responses are clear and actionable
- [ ] AI prompts use enemy personality traits effectively
- [ ] Generated dialogue matches enemy tone and verbosity
- [ ] Player combat history influences dialogue context
- [ ] Code follows existing backend patterns and conventions
- [ ] Unit tests cover service layer logic
- [ ] Integration tests validate API endpoints
- [ ] Documentation updated in api-contracts.yaml

## Relevant Files

### Existing Files to Reference
- `docs/feature-specs/F-12-enemy-ai-personality-system.yaml` - Complete feature specification
- `docs/api-contracts.yaml` - API endpoint definitions (lines 1725-1814)
- `mystica-express/migrations/001_initial_schema.sql` - Database schema (lines 493-531, 656-673)
- `mystica-express/src/config/env.ts` - Environment configuration with OPENAI_API_KEY
- `mystica-express/src/utils/errors.ts` - Error classes (ExternalAPIError, NotFoundError)
- `mystica-express/src/types/database.types.ts` - Generated Supabase types
- `mystica-express/src/types/schemas.ts` - Zod validation schemas
- `scripts/generate-item-description.ts` - OpenAI integration reference pattern
- `mystica-express/src/services/LocationService.ts` - Complete service implementation example
- `mystica-express/src/controllers/LocationController.ts` - Controller pattern example
- `mystica-express/src/routes/locations.ts` - Route handler pattern example
- `mystica-express/src/middleware/auth.ts` - Authentication middleware
- `mystica-express/src/middleware/validate.ts` - Validation middleware

### Files to Create
- `mystica-express/src/services/EnemyChatterService.ts` - Core dialogue generation logic
- `mystica-express/src/services/CombatStubService.ts` - Stubbed combat session provider
- `mystica-express/src/controllers/CombatController.ts` - Combat chatter endpoint handler
- `mystica-express/src/controllers/EnemyController.ts` - Enemy types endpoint handler
- `mystica-express/src/routes/combat.ts` - Combat route definitions
- `mystica-express/src/routes/enemies.ts` - Enemy route definitions
- `mystica-express/src/types/combat.types.ts` - Combat session and event type definitions
- `mystica-express/tests/unit/services/EnemyChatterService.test.ts` - Unit tests
- `mystica-express/tests/integration/combat.test.ts` - Integration tests
- `mystica-express/tests/integration/enemies.test.ts` - Integration tests

### Files to Modify
- `mystica-express/src/app.ts` - Register new combat and enemy routes
- `mystica-express/src/types/schemas.ts` - Add EnemyChatterSchema and related schemas (lines 141-155 already exist)
- `mystica-express/src/types/api.types.ts` - Add combat dialogue types

### Database Tables (Already Exist)
- `enemytypes` - 5 enemy types with personality data (verified populated)
- `playercombathistory` - Player statistics per location
- `enemychatterlog` - Analytics logging for dialogue generation
