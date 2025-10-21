# Implementation Plan – F-12 Enemy Combat Dialogue Backend

## Overview
- **Item ID:** F-12
- **Spec:** `docs/feature-specs/F-12-enemy-ai-personality-system.yaml`
- **Requirements:** `docs/plans/combat-dialogue-generation/requirements.md`
- **Investigations:**
  - `docs/plans/combat-dialogue-generation/investigations/f12-enemy-ai-current-state.md`
  - `docs/plans/combat-dialogue-generation/investigations/openai-integration-patterns.md`
  - `docs/plans/combat-dialogue-generation/investigations/f11-pet-personality-current-state.md`

## Solution
- Implement 3 backend API endpoints for enemy combat dialogue generation using OpenAI GPT-4.1-nano
- Create service layer with AI dialogue generation, stubbed combat sessions, and player history tracking
- Follow existing OpenAI integration patterns from `scripts/generate-item-description.ts`
- Use fallback to database `example_taunts` when AI unavailable
- Log all dialogue attempts to `enemychatterlog` for analytics

## Current System

**Existing Infrastructure:**
- Database schema complete: `enemytypes`, `playercombathistory`, `enemychatterlog` tables
- 5 enemy types seeded with personality data (verified via SQL query)
- OpenAI integration pattern established in `scripts/generate-item-description.ts`
- Vercel AI SDK with Zod schema validation: `@ai-sdk/openai` v2.0.53, `ai` v5.0.76
- Express backend with auth middleware, error handling, validation patterns
- Service layer pattern from `src/services/LocationService.ts`

**Where New Code Fits:**
- Services: `src/services/EnemyChatterService.ts`, `src/services/CombatStubService.ts`
- Controllers: `src/controllers/CombatController.ts`, `src/controllers/EnemyController.ts`
- Routes: `src/routes/combat.ts`, `src/routes/enemies.ts`
- Types: `src/types/combat.types.ts` (new), extend `src/types/schemas.ts` and `src/types/api.types.ts`
- App registration: `src/app.ts` (add route imports)

## Changes Required

### 1) `src/services/EnemyChatterService.ts`: NEW FILE
- **Purpose**: Core dialogue generation logic with OpenAI integration
- **Responsibilities**:
  - Generate AI dialogue using GPT-4.1-nano with enemy personality prompts
  - Fallback to random `example_taunts` on AI failure
  - Log all attempts to `enemychatterlog`
  - Integrate player combat history into AI context
- **Key Methods**:
  - `generateDialogue(sessionId, eventType, eventDetails)` → DialogueResponse
  - `buildAIPrompt(enemyType, combatContext, playerHistory)` → {system, user}
  - `selectFallbackTaunt(enemyType, eventType)` → string
  - `logDialogueAttempt(...)` → void
- **Dependencies**: Supabase client, OpenAI client, CombatStubService
- **Pattern Reference**: `scripts/generate-item-description.ts:45-65`, `docs/plans/combat-dialogue-generation/investigations/openai-integration-patterns.md:29-46`

### 2) `src/services/CombatStubService.ts`: NEW FILE
- **Purpose**: Stubbed combat session provider until F-02 implemented
- **Responsibilities**:
  - Return hardcoded combat session data for testing
  - Validate session_id format
  - Throw NotFoundError for invalid sessions
- **Key Methods**:
  - `getCombatSession(sessionId)` → CombatSession | null
  - `getHardcodedSessions()` → Map<UUID, CombatSession>
- **Hardcoded Data Structure**:
```typescript
{
  session_id: UUID,
  enemy_type_id: UUID,
  player_id: UUID,
  location_id: UUID,
  turn_number: number,
  player_hp: number,
  player_max_hp: number,
  enemy_hp: number,
  enemy_max_hp: number,
  created_at: Date
}
```

### 3) `src/controllers/CombatController.ts`: NEW FILE
- **Purpose**: Handle POST /combat/enemy-chatter endpoint
- **Responsibilities**:
  - Validate request via Zod schema
  - Coordinate between CombatStubService and EnemyChatterService
  - Return formatted dialogue response
  - Handle errors with appropriate status codes
- **Key Methods**:
  - `generateEnemyChatter(req, res, next)` → void
- **Error Handling**:
  - 400: Invalid event_type or malformed request
  - 404: Combat session not found
  - 503: OpenAI unavailable (after fallback exhausted)
- **Pattern Reference**: `src/controllers/LocationController.ts`

### 4) `src/controllers/EnemyController.ts`: NEW FILE
- **Purpose**: Handle enemy-related endpoints
- **Responsibilities**:
  - GET /enemies/types: Return all enemy personality data from database
  - GET /players/combat-history/:location_id: Return player stats at location
- **Key Methods**:
  - `getEnemyTypes(req, res, next)` → void
  - `getPlayerCombatHistory(req, res, next)` → void
- **Database Queries**:
  - Query `enemytypes` with personality traits, taunts
  - Query `playercombathistory` by user_id + location_id
  - Return zeroed stats if no history exists

### 5) `src/routes/combat.ts` and `src/routes/enemies.ts`: NEW FILES
- **Purpose**: Define API routes and apply middleware
- **Routes**:
  - `POST /api/v1/combat/enemy-chatter` (auth required, validation)
  - `GET /api/v1/enemies/types` (public, no auth)
  - `GET /api/v1/players/combat-history/:location_id` (auth required)
- **Middleware Chain**: Auth → Validation → Controller → Error Handler
- **Pattern Reference**: `src/routes/locations.ts`

### 6) `src/types/combat.types.ts`: NEW FILE
- **Purpose**: TypeScript types for combat domain
- **Types to Define**:
```typescript
export interface CombatSession {
  session_id: string;
  enemy_type_id: string;
  player_id: string;
  location_id: string;
  turn_number: number;
  player_hp: number;
  player_max_hp: number;
  enemy_hp: number;
  enemy_max_hp: number;
  created_at: Date;
}

export interface CombatEventDetails {
  damage?: number;
  accuracy?: number;
  is_critical?: boolean;
  turn_number: number;
  player_hp_pct: number;
  enemy_hp_pct: number;
}

export interface DialogueResponse {
  dialogue: string;
  enemy_type: string;
  dialogue_tone: string;
  generation_time_ms: number;
  was_ai_generated?: boolean;
  player_context_used: PlayerCombatContext;
}

export interface PlayerCombatContext {
  attempts: number;
  victories: number;
  defeats: number;
  current_streak: number;
}

export type CombatEventType =
  | 'combat_start'
  | 'player_hit'
  | 'player_miss'
  | 'enemy_hit'
  | 'low_player_hp'
  | 'near_victory'
  | 'defeat'
  | 'victory';
```

### 7) `src/types/schemas.ts`: EXTEND
- **Current**: EnemyChatterSchema exists (lines 141-155) but incomplete
- **Change**: Enhance validation for combat dialogue endpoints
```typescript
export const EnemyChatterRequestSchema = z.object({
  session_id: z.string().uuid(),
  event_type: z.enum([
    'combat_start', 'player_hit', 'player_miss', 'enemy_hit',
    'low_player_hp', 'near_victory', 'defeat', 'victory'
  ]),
  event_details: z.object({
    damage: z.number().int().nonnegative().optional(),
    accuracy: z.number().min(0).max(1).optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().positive(),
    player_hp_pct: z.number().min(0).max(1),
    enemy_hp_pct: z.number().min(0).max(1)
  })
});
```

### 8) `src/app.ts`: MODIFY
- **Current**: Routes registered for locations, inventory, materials, etc.
- **Change**: Add combat and enemy route imports and registration
```typescript
import combatRoutes from './routes/combat.js';
import enemyRoutes from './routes/enemies.js';

// Register routes
app.use('/api/v1/combat', combatRoutes);
app.use('/api/v1/enemies', enemyRoutes);
```

## Task Breakdown

| ID | Description | Agent | Deps | Files | Exit Criteria |
|----|-------------|-------|------|-------|---------------|
| T1 | **Create combat type definitions** - Define TypeScript interfaces for CombatSession, DialogueResponse, event types | backend-developer | — | `src/types/combat.types.ts` (new) | Types compile, exported, documented with JSDoc |
| T2 | **Extend Zod schemas** - Add EnemyChatterRequestSchema with full validation | backend-developer | — | `src/types/schemas.ts` (extend lines 141-155) | Schema validates all edge cases, rejects invalid inputs |
| T3 | **Implement CombatStubService** - Hardcoded combat session provider with 3-5 test sessions | backend-developer | T1 | `src/services/CombatStubService.ts` (new) | Returns valid sessions, throws NotFoundError for invalid IDs |
| T4 | **Implement EnemyChatterService** - Core dialogue generation with OpenAI integration, fallback logic, database logging | backend-developer | T1, T2 | `src/services/EnemyChatterService.ts` (new) | Generates AI dialogue, falls back to taunts, logs to DB, <2s response |
| T5 | **Implement CombatController** - POST /combat/enemy-chatter endpoint handler | backend-developer | T3, T4 | `src/controllers/CombatController.ts` (new) | Endpoint returns 200 with dialogue, handles errors correctly |
| T6 | **Implement EnemyController** - GET /enemies/types and GET /players/combat-history endpoints | backend-developer | T1 | `src/controllers/EnemyController.ts` (new) | Both endpoints return correct data, handle missing records |
| T7 | **Create route definitions** - Define combat and enemy routes with middleware chain | backend-developer | T5, T6 | `src/routes/combat.ts` (new), `src/routes/enemies.ts` (new) | Routes registered, middleware applied, paths match API contracts |
| T8 | **Register routes in app** - Import and mount combat/enemy routes | backend-developer | T7 | `src/app.ts` (modify lines ~60) | Routes accessible, no conflicts, server starts successfully |
| T9 | **Integration tests** - Test all 3 endpoints with real database and stubbed combat | backend-developer | T8 | `tests/integration/combat.test.ts` (new), `tests/integration/enemies.test.ts` (new) | All endpoints tested, edge cases covered, tests pass |

## Parallelization

### Batch 1 (No Dependencies - Parallel)
- **Tasks:** T1, T2
- **Agent:** `backend-developer`
- **Duration:** ~15-20 min
- **Notes:**
  - Both are pure type/schema definitions
  - No runtime dependencies
  - Can be implemented simultaneously
  - T1 creates interfaces, T2 creates validation schemas

### Batch 2 (Depends on Batch 1 - Parallel)
- **Tasks:** T3, T4, T6
- **Agent:** `backend-developer` (3 parallel instances)
- **Duration:** ~30-40 min
- **Dependencies:**
  - T3 depends on T1 (CombatSession type)
  - T4 depends on T1, T2 (types + schemas)
  - T6 depends on T1 (types only)
- **Notes:**
  - T3 is lightweight stub (10 min)
  - T4 is complex OpenAI integration (30 min)
  - T6 is simple CRUD (15 min)
  - All three are independent service/controller implementations

### Batch 3 (Depends on Batch 2 - Sequential)
- **Tasks:** T5 → T7 → T8
- **Agent:** `backend-developer`
- **Duration:** ~25-30 min
- **Dependencies:**
  - T5 depends on T3, T4 (needs both services)
  - T7 depends on T5, T6 (needs both controllers)
  - T8 depends on T7 (needs routes defined)
- **Notes:**
  - Must run sequentially due to layered dependencies
  - T5 orchestrates T3 and T4
  - T7 wires up T5 and T6
  - T8 registers everything in app

### Batch 4 (Validation - Final)
- **Tasks:** T9
- **Agent:** `backend-developer`
- **Duration:** ~20-25 min
- **Dependencies:** All previous tasks (T1-T8)
- **Notes:**
  - Integration tests validate full stack
  - Tests real database interactions
  - Verifies API contracts match implementation
  - Can only run after routes are registered

**Total Estimated Duration:** 90-115 minutes
**Parallelization Savings:** ~40% faster than sequential execution

## Data/Schema Changes
- **No migrations needed** - Database schema already complete
- **Tables used**:
  - `enemytypes` (read) - 5 enemy types with personality data
  - `playercombathistory` (read/write) - Player stats per location
  - `enemychatterlog` (write) - Analytics logging
- **API endpoints**:
  - `POST /api/v1/combat/enemy-chatter` - Generate dialogue
  - `GET /api/v1/enemies/types` - List personalities
  - `GET /api/v1/players/combat-history/:location_id` - Get stats

## Expected Result
- **3 working API endpoints** matching `docs/api-contracts.yaml` specification
- **AI-generated enemy dialogue** in <2s with personality-appropriate tone
- **Fallback system** using database `example_taunts` when OpenAI unavailable
- **Analytics logging** tracking all dialogue attempts with generation_time_ms
- **Player combat history** influencing AI context (taunting repeat losers, welcoming newcomers)
- **Comprehensive tests** covering happy path, error cases, and edge cases

**Concrete Examples:**
- `POST /combat/enemy-chatter` with `event_type: "player_hit"` returns Spray Paint Goblin saying *"Ha! Call that a hit? I've been tickled harder by a feather!"* in aggressive tone
- `GET /enemies/types` returns all 5 enemy types with personality traits and example taunts
- `GET /players/combat-history/{location_id}` returns `{attempts: 0, victories: 0, ...}` for first-time players

## Implementation Notes

### Critical Success Factors
1. **Follow OpenAI pattern exactly** from `scripts/generate-item-description.ts:45-65`
   - Use `generateObject()` with Zod schema
   - 2s timeout with fallback
   - Structured system prompts from database
2. **Use Supabase generated types** from `src/types/database.types.ts`
   - Type-safe database queries
   - Avoid `any` types
3. **Error handling consistency** with existing patterns
   - `ExternalAPIError` for OpenAI failures
   - `NotFoundError` for missing combat sessions
   - `ValidationError` for bad requests
4. **Test database interactions** against real Supabase remote
   - No mocks for database tests
   - Verify 5 enemy types exist
   - Test `playercombathistory` CRUD

### Risk Mitigation
- **OpenAI API unreliability**: Fallback to `example_taunts` tested separately
- **GPT-4.1-nano unavailability**: Can substitute `gpt-4.1-mini` if needed
- **Combat system dependency**: Stubbed completely, no F-02 blocker
- **Rate limiting**: Documented but not implemented (defer to future)

## Next
```bash
/manage-project/implement/execute F-12
```

Run execution phase to implement all 9 tasks in 4 parallelized batches.
