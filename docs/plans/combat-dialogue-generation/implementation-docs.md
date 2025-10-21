# F-12 Enemy Combat Dialogue Backend - Implementation Documentation

**Feature ID:** F-12
**Status:** Ready for Implementation
**Implementation Plan:** [implement-plan.md](./implement-plan.md)
**Requirements:** [requirements.md](./requirements.md)
**Current State:** [investigations/f12-enemy-ai-current-state.md](./investigations/f12-enemy-ai-current-state.md)

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture Summary](#architecture-summary)
3. [Implementation Guide](#implementation-guide)
4. [API Reference](#api-reference)
5. [Integration Points](#integration-points)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Checklist](#deployment-checklist)
8. [Troubleshooting](#troubleshooting)

## Feature Overview

### What It Does
F-12 Enemy AI Personality System generates dynamic, AI-powered trash-talk during combat encounters. Each enemy type has distinct personality traits that influence dialogue tone and content. The system responds to combat events (hits, misses, low HP, victory/defeat) with contextual dialogue that incorporates player combat history.

### Why It Matters
- **Engagement:** Transforms static enemies into memorable, personality-driven opponents
- **Replayability:** Dynamic AI-generated content creates unique experiences each encounter
- **Immersion:** Contextual dialogue that responds to combat state and player performance
- **Analytics:** Comprehensive logging provides insights into AI generation performance

### User Benefit
Players experience engaging combat with enemies that "talk back" with personality-appropriate trash-talk, making each encounter feel unique and memorable rather than repetitive.

## Architecture Summary

### High-Level Design

```
Combat Event → API Request → Combat Controller → Enemy Chatter Service → OpenAI GPT-4.1-nano
                                ↓                          ↓
                        Combat Stub Service    Player Combat History
                                ↓                          ↓
                        Session Validation      Analytics Logging → Database
                                ↓                          ↓
                          Response ← Generated Dialogue ← Fallback System
```

### Core Components

1. **Service Layer**
   - `EnemyChatterService`: AI dialogue generation with fallback logic
   - `CombatStubService`: Hardcoded combat sessions (until F-02 implemented)

2. **Controller Layer**
   - `CombatController`: Handles `/combat/enemy-chatter` endpoint
   - `EnemyController`: Manages enemy types and player history endpoints

3. **API Endpoints**
   - `POST /api/v1/combat/enemy-chatter` - Generate dialogue for combat events
   - `GET /api/v1/enemies/types` - List enemy personality types
   - `GET /api/v1/players/combat-history/:location_id` - Player combat statistics

4. **Integration Points**
   - **OpenAI GPT-4.1-nano**: AI dialogue generation (~$0.0001/request)
   - **Supabase PostgreSQL**: Enemy types, combat history, analytics logging
   - **Stubbed Combat System**: Temporary hardcoded sessions until F-02

## Implementation Guide

### Prerequisites

**Environment Setup:**
```bash
# Required environment variables
OPENAI_API_KEY=sk-...                    # OpenAI API access
SUPABASE_URL=https://xxx.supabase.co     # Database connection
SUPABASE_SERVICE_ROLE_KEY=...            # Backend service role
```

**Database Verification:**
```sql
-- Verify enemy types exist (should return 5 rows)
SELECT name, dialogue_tone, ai_personality_traits FROM enemytypes;

-- Verify tables exist
\d playercombathistory
\d enemychatterlog
```

### Step-by-Step Implementation

#### Phase 1: Type Definitions (Parallel - 15-20 min)

**Task T1: Create Combat Types** (`src/types/combat.types.ts`)
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

export interface DialogueResponse {
  dialogue: string;
  enemy_type: string;
  dialogue_tone: string;
  generation_time_ms: number;
  was_ai_generated?: boolean;
  player_context_used: PlayerCombatContext;
}

export type CombatEventType =
  | 'combat_start' | 'player_hit' | 'player_miss' | 'enemy_hit'
  | 'low_player_hp' | 'near_victory' | 'defeat' | 'victory';
```

**Task T2: Extend Zod Schemas** (`src/types/schemas.ts` lines 141-155)
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

#### Phase 2: Service Implementation (Parallel - 30-40 min)

**Task T3: Combat Stub Service** (`src/services/CombatStubService.ts`)
```typescript
export class CombatStubService {
  private hardcodedSessions = new Map<string, CombatSession>();

  constructor() {
    // Initialize 3-5 test sessions with different enemy types
    this.initializeTestSessions();
  }

  getCombatSession(sessionId: string): CombatSession | null {
    return this.hardcodedSessions.get(sessionId) || null;
  }
}
```

**Task T4: Enemy Chatter Service** (`src/services/EnemyChatterService.ts`)
- Follow OpenAI pattern from `scripts/generate-item-description.ts:45-65`
- Use `generateObject()` with Zod schema validation
- 2s timeout with fallback to database `example_taunts`
- Log all attempts to `enemychatterlog`

**Task T6: Enemy Controller** (`src/controllers/EnemyController.ts`)
```typescript
export class EnemyController {
  async getEnemyTypes(req: Request, res: Response, next: NextFunction) {
    // Query enemytypes table, return personality data
  }

  async getPlayerCombatHistory(req: Request, res: Response, next: NextFunction) {
    // Query playercombathistory by user_id + location_id
    // Return zeroed stats if no history exists
  }
}
```

#### Phase 3: Route Integration (Sequential - 25-30 min)

**Task T5: Combat Controller** → **Task T7: Route Definitions** → **Task T8: App Registration**

**Route Registration** (`src/app.ts`)
```typescript
import combatRoutes from './routes/combat.js';
import enemyRoutes from './routes/enemies.js';

// Register routes
app.use('/api/v1/combat', combatRoutes);
app.use('/api/v1/enemies', enemyRoutes);
```

#### Phase 4: Testing & Validation (20-25 min)

**Task T9: Integration Tests**
- Test all 3 endpoints with real database
- Verify AI generation and fallback behavior
- Test error handling and edge cases

### Expected Timeline
- **Total Duration:** 90-115 minutes
- **Parallelization Savings:** ~40% faster than sequential
- **Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4

## API Reference

### POST /api/v1/combat/enemy-chatter

Generate enemy dialogue for combat events.

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

**Response (200 OK - AI Generated):**
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

**Response (200 OK - Fallback):**
```json
{
  "dialogue": "Your defense is wack, like a toy tagger!",
  "enemy_type": "Spray Paint Goblin",
  "dialogue_tone": "aggressive",
  "generation_time_ms": 12,
  "was_ai_generated": false,
  "player_context_used": { /* same as above */ }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid event_type or malformed request
- `404 Not Found`: Combat session not found or expired
- `503 Service Unavailable`: OpenAI completely down after fallback

### GET /api/v1/enemies/types

List all enemy personality types.

**Authentication:** Not required (public endpoint)

**Response (200 OK):**
```json
{
  "enemy_types": [
    {
      "type": "spray_paint_goblin",
      "display_name": "Spray Paint Goblin",
      "personality_traits": ["street-smart urban artist", "sarcastic and witty"],
      "dialogue_tone": "aggressive",
      "verbosity": "moderate",
      "example_taunts": [
        "Your defense is wack, like a toy tagger!",
        "Gonna spray paint this L on your face!"
      ]
    }
  ]
}
```

### GET /api/v1/players/combat-history/:location_id

Get player's combat statistics at a specific location.

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

## Integration Points

### OpenAI Integration

**Model:** GPT-4.1-nano (~$0.0001/request, 500-1500ms response time)

**System Prompt Pattern:**
```typescript
const systemPrompt = `You are ${enemyType.display_name} with personality: ${traits.join(', ')}.
Generate 1-2 sentences of ${dialogueTone} trash-talk for: ${eventType}.
Combat context: Player ${playerHpPct}% HP, Enemy ${enemyHpPct}% HP.
Player history: ${attempts} attempts, ${victories} wins, ${defeats} losses.`;
```

**Error Handling:**
1. Try `generateObject()` with 2s timeout
2. On failure: Log warning, select random `example_taunt`
3. Return fallback with `was_ai_generated: false`
4. Log attempt regardless of success

### Supabase Database

**Tables Used:**
- `enemytypes` (read): Enemy personality data and example taunts
- `playercombathistory` (read/write): Player stats per location
- `enemychatterlog` (write): Analytics logging for all dialogue attempts

**Query Patterns:**
```sql
-- Get enemy personality data
SELECT ai_personality_traits, dialogue_tone, example_taunts
FROM enemytypes WHERE id = $1;

-- Get player combat history
SELECT total_attempts, victories, defeats, current_streak
FROM playercombathistory
WHERE user_id = $1 AND location_id = $2;

-- Log dialogue attempt
INSERT INTO enemychatterlog (session_id, enemy_type_id, event_type,
  generated_dialogue, generation_time_ms, was_ai_generated)
VALUES ($1, $2, $3, $4, $5, $6);
```

### Combat System Integration

**Current State:** F-02 Combat System not implemented - using stubbed sessions

**Stub Implementation:**
- Hardcoded `Map<UUID, CombatSession>` in `CombatStubService`
- 3-5 test sessions with different enemy types
- Validates session_id format and existence
- Throws `NotFoundError` for invalid sessions

**Migration Path:** Replace stub with Redis combat session lookup when F-02 ready

## Testing Strategy

### Unit Tests

**EnemyChatterService Tests:**
```typescript
describe('EnemyChatterService', () => {
  test('generates AI dialogue with valid session', async () => {
    // Mock OpenAI success response
    // Verify dialogue format and player context
  });

  test('falls back to example taunts on AI failure', async () => {
    // Mock OpenAI timeout/error
    // Verify fallback dialogue and was_ai_generated=false
  });

  test('logs all dialogue attempts', async () => {
    // Verify enemychatterlog insert regardless of AI success
  });
});
```

**CombatStubService Tests:**
```typescript
describe('CombatStubService', () => {
  test('returns valid combat session for hardcoded IDs', () => {
    // Test successful session lookup
  });

  test('returns null for invalid session IDs', () => {
    // Test session not found scenario
  });
});
```

### Integration Tests

**API Endpoint Tests:**
```typescript
describe('POST /api/v1/combat/enemy-chatter', () => {
  test('generates dialogue for valid combat event', async () => {
    const response = await request(app)
      .post('/api/v1/combat/enemy-chatter')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validChatterRequest);

    expect(response.status).toBe(200);
    expect(response.body.dialogue).toBeDefined();
    expect(response.body.generation_time_ms).toBeGreaterThan(0);
  });
});
```

**Database Integration Tests:**
- Verify enemy types query returns 5 rows
- Test player combat history CRUD operations
- Validate analytics logging to `enemychatterlog`

### Coverage Requirements

- **Minimum Coverage:** 85% for service layer
- **Critical Paths:** AI generation, fallback logic, error handling
- **Edge Cases:** Invalid sessions, OpenAI failures, malformed requests

## Deployment Checklist

### Environment Variables
```bash
# Verify required variables
✓ OPENAI_API_KEY - Valid OpenAI API key
✓ SUPABASE_URL - Database connection string
✓ SUPABASE_SERVICE_ROLE_KEY - Backend service role key
```

### Database Verification
```sql
-- Verify enemy types seeded (should return 5)
SELECT COUNT(*) FROM enemytypes;

-- Verify table schemas exist
\d playercombathistory
\d enemychatterlog

-- Test enemy type query
SELECT name, dialogue_tone, ai_personality_traits FROM enemytypes LIMIT 1;
```

### API Testing
```bash
# Test enemy types endpoint (public)
curl https://api.mystica.app/v1/enemies/types

# Test auth-protected endpoints require valid JWT
curl -H "Authorization: Bearer invalid" \
  https://api.mystica.app/v1/players/combat-history/uuid

# Test dialogue generation with valid session
curl -X POST https://api.mystica.app/v1/combat/enemy-chatter \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"valid-uuid","event_type":"player_hit",...}'
```

### Performance Verification
- **AI Generation:** < 2000ms per request
- **Database Queries:** < 100ms for combat history
- **Fallback Response:** < 50ms when AI unavailable
- **Total Endpoint Response:** < 2500ms including AI generation

## Troubleshooting

### Common Errors

**"Combat session not found" (404)**
```typescript
// Check CombatStubService hardcoded sessions
const validSessions = combatStubService.getHardcodedSessions();
console.log('Valid session IDs:', Array.from(validSessions.keys()));
```

**"OpenAI API error" (503)**
```typescript
// Verify environment variable
console.log('OpenAI key configured:', !!process.env.OPENAI_API_KEY);

// Check fallback behavior
// Should return example_taunts with was_ai_generated: false
```

**"Validation failed" (400)**
```typescript
// Check Zod schema validation
import { EnemyChatterRequestSchema } from '../types/schemas.js';

try {
  EnemyChatterRequestSchema.parse(requestBody);
} catch (error) {
  console.log('Validation errors:', error.errors);
}
```

### Debug Logging

**Enable verbose logging:**
```typescript
// In EnemyChatterService
console.log('AI prompt:', systemPrompt);
console.log('AI response time:', generationTimeMs);
console.log('Fallback triggered:', !wasAiGenerated);
```

**Database query debugging:**
```sql
-- Check player combat history
SELECT * FROM playercombathistory WHERE user_id = 'user-uuid';

-- Check dialogue logging
SELECT event_type, was_ai_generated, generation_time_ms
FROM enemychatterlog
ORDER BY timestamp DESC LIMIT 10;
```

### Performance Issues

**Slow AI Generation (>2s):**
- Check OpenAI API status: https://status.openai.com/
- Verify prompt length (shorter prompts = faster responses)
- Monitor `generation_time_ms` in logs

**High Fallback Rate:**
- Check OpenAI API key validity
- Monitor error logs for timeout patterns
- Verify network connectivity to OpenAI

**Database Connection Issues:**
```typescript
// Test Supabase connection
const { data, error } = await supabase
  .from('enemytypes')
  .select('name')
  .limit(1);

if (error) console.error('Database error:', error);
```

### Monitoring & Analytics

**Key Metrics to Track:**
- AI generation success rate (`was_ai_generated: true` percentage)
- Average generation time per enemy type
- Most common combat events triggering dialogue
- Player engagement (requests per combat session)

**Log Analysis:**
```sql
-- AI generation success rate
SELECT
  was_ai_generated,
  COUNT(*) as count,
  AVG(generation_time_ms) as avg_time
FROM enemychatterlog
GROUP BY was_ai_generated;

-- Most common event types
SELECT event_type, COUNT(*) as frequency
FROM enemychatterlog
GROUP BY event_type
ORDER BY frequency DESC;
```

---

**Next Steps After Implementation:**
1. Run integration tests against real Supabase database
2. Load test with multiple concurrent dialogue requests
3. Monitor AI generation success rates and fallback behavior
4. Prepare for F-02 Combat System integration (replace stubs)
5. Consider rate limiting for production deployment