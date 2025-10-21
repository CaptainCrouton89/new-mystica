# Investigation: F-11 Pet Personality System Current State

> Analysis of existing specifications and implementation status for F-11 Pet Personality System - AI-powered dynamic pet personalities that generate contextual trash-talk during combat.

## Goal
Understand the current specification and implementation status of F-11 Pet Personality System to assess what needs to be built for combat dialogue generation.

## Related Docs
- `docs/feature-specs/F-11-pet-personality-system.yaml` – Complete feature specification
- `docs/product-requirements.yaml:90-93` – F-11 definition in PRD
- `docs/api-contracts.yaml:314-723` – Pet personality API endpoints defined

## Key Files

### Feature Specification
- `docs/feature-specs/F-11-pet-personality-system.yaml:1-233` – Complete spec with data schema, APIs, and implementation notes

### Database Schema (IMPLEMENTED)
- `mystica-express/migrations/001_initial_schema.sql:453-463` – PetPersonalities table (seed data)
- `mystica-express/migrations/001_initial_schema.sql:465-476` – Pets table (extends Items)
- `mystica-express/migrations/001_initial_schema.sql:637-653` – CombatChatterLog table (analytics)

### Type Definitions (PARTIAL)
- `mystica-express/src/types/schemas.ts:120-138` – Zod validation schemas for pet personality endpoints
- `mystica-express/src/types/database.types.ts:1363-1437` – Supabase generated types for database tables

### API Contracts (SPECIFIED)
- `docs/api-contracts.yaml:1616-1659` – POST /combat/pet-chatter endpoint
- `docs/api-contracts.yaml:1661-1676` – GET /pets/personalities endpoint
- `docs/api-contracts.yaml:1678-1723` – PUT /pets/{pet_id}/personality endpoint

## Database Tables

- **`PetPersonalities`**: columns `id, personality_type, display_name, description, traits, base_dialogue_style, example_phrases, verbosity` – Seed data for 6 personality types
- **`Pets`**: columns `item_id, personality_id, custom_name, chatter_history` – Links pet items to personalities with optional custom names
- **`CombatChatterLog`**: columns `id, session_id, pet_item_id, event_type, combat_context, generated_dialogue, personality_type, generation_time_ms, was_ai_generated, timestamp` – Analytics for dialogue generation

## Personality Types Defined

From `docs/feature-specs/F-11-pet-personality-system.yaml:25-151`:

1. **sassy** - Witty, sarcastic, confident - Example: "Ha! Nice hit, but the Spray Paint Goblin is still uglier than my morning breath!"
2. **encouraging** - Supportive, optimistic, enthusiastic - Example: "Great job! You're doing amazing!"
3. **analytical** - Observant, strategic, calm - Example: "Enemy defense is weak. Exploit their left flank."
4. **chaotic** - Random, energetic, absurd - Example: "BANANA TORNADO INCOMING!"
5. **stoic** - Calm, terse, wise - Example: "...adequate."
6. **trash_talker** - Aggressive, competitive, bold - Example: "You call that an attack? I've seen kittens with more bite!"

## Event Types for Dialogue Generation

From `docs/feature-specs/F-11-pet-personality-system.yaml:45`:
- `player_attack` - Player initiates attack
- `player_defense` - Player defends against enemy
- `enemy_attack` - Enemy attacks player
- `enemy_defense` - Enemy defends against player attack
- `critical_hit` - Critical hit occurs
- `miss` - Attack misses
- `victory` - Combat victory
- `defeat` - Combat defeat

## Data Flow (Specified)

From `docs/feature-specs/F-11-pet-personality-system.yaml:174-196`:

1. Combat system triggers → POST /combat/pet-chatter with event_type and details
2. Backend retrieves pet personality from player_pet_personalities (joined on equipped pet)
3. Backend gets combat session context from Redis (HP %, turn count, previous events)
4. Backend constructs AI prompt with personality traits and combat context
5. AI generates dialogue (OpenAI/Anthropic with 1-2s timeout)
6. Backend logs to CombatChatterLog for analytics
7. Response sent to client with dialogue and personality_type
8. Client displays dialogue in speech bubble above pet sprite (2-3s duration) with sound effect

## Implementation Status

### ✅ COMPLETED
- Database schema fully defined and applied (001_initial_schema.sql)
- API contracts completely specified with request/response schemas
- Zod validation schemas defined for all endpoints
- Complete feature specification with detailed implementation notes
- 6 personality types defined with traits and example phrases
- Event types enumerated for all combat scenarios
- Fallback strategy specified (canned phrases if AI unavailable)

### ❌ NOT IMPLEMENTED
- **No service layer** - No PetPersonalityService, CombatChatterService, or AI dialogue generation service
- **No controllers** - No endpoints implemented for pet personality management
- **No routes** - No route handlers for /combat/pet-chatter, /pets/personalities, or /pets/{pet_id}/personality
- **No AI integration** - No OpenAI/Anthropic service for dialogue generation
- **No fallback logic** - No canned phrase system for AI service failures
- **No combat integration** - No hooks from combat system to trigger chatter generation

### 🔧 TECHNICAL DETAILS

**AI Model Specified**: GPT-4.1-nano for cost efficiency (~$0.0001/message)

**MVP Approach**:
- MVP0: Hardcode 2-3 personalities with canned phrases only (no AI)
- Full MVP: AI integration with 6 personality types, player assignment, analytics logging

**Performance Requirements**:
- 1-2s AI generation timeout
- Throttling: 1 message/turn max
- Fallback to example_phrases on AI failure

## Integration Points

- **Combat System (F-02)**: Must trigger chatter generation on combat events - NOT YET IMPLEMENTED
- **Base Items & Equipment (F-03)**: Pet slot equipment system - DATABASE SCHEMA EXISTS
- **AI Generation Service**: Shared with item generation - PARTIAL (ImageGenerationService exists but no dialogue service)
- **Combat session state (Redis)**: For event context - NOT IMPLEMENTED

## Notes

- Schema indicates `player_pet_personalities` table mentioned in spec may actually be implemented as `Pets` table with foreign key to `PetPersonalities`
- Database design supports the full feature but no backend logic exists
- API contracts are complete and match the feature specification exactly
- Implementation priority: MVP0 approach with canned phrases would be faster to implement than full AI integration
- Cost considerations documented: ~$0.0001/message for GPT-4.1-nano model

## Next Steps

1. **Implement service layer**: Create PetPersonalityService for personality management and CombatChatterService for dialogue generation
2. **Build controllers**: Implement endpoints for personality assignment and chatter generation
3. **Create routes**: Wire up the three API endpoints specified in contracts
4. **Integrate with combat**: Add hooks in combat system to trigger chatter generation
5. **Add AI service**: Integrate OpenAI API for dynamic dialogue generation (or start with canned phrases for MVP0)