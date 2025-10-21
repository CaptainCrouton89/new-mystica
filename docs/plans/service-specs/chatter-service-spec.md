# Chatter Service Specification

**Document Version**: 1.0
**Last Updated**: 2025-01-27
**Related Features**: F-11 Pet Personality & Chatter, F-12 Enemy Trash Talk
**Target Release**: MVP1

## Overview

This specification defines the complete ChatterService implementation for AI-powered dialogue generation in the New Mystica combat system. The service generates contextual pet chatter (F-11) and enemy trash-talk (F-12) using OpenAI's GPT-4.1-nano model with intelligent fallback strategies.

### Key Capabilities

- **Pet Personality Chatter**: AI-generated dialogue based on pet personality traits and combat events
- **Enemy Trash Talk**: Context-aware enemy taunts using player combat history and performance
- **Intelligent Fallbacks**: Seed data phrases when AI service unavailable
- **Performance Optimized**: 2-second timeout with graceful degradation
- **Analytics Integration**: Comprehensive logging for dialogue quality analysis

## Service Layer Architecture

### ChatterService Public Methods

The ChatterService implements the following public interface:

```typescript
export class ChatterService {
  // Pet chatter generation (F-11)
  async generatePetChatter(sessionId: string, eventType: PetChatterEventType, eventDetails: CombatEventDetails): Promise<ChatterResponse>

  // Enemy chatter generation (F-12)
  async generateEnemyChatter(sessionId: string, eventType: EnemyChatterEventType, eventDetails: CombatEventDetails): Promise<EnemyChatterResponse>

  // Personality management (F-11)
  async getPetPersonalities(): Promise<PetPersonality[]>
  async assignPetPersonality(petId: string, personalityType: string, customName?: string): Promise<PersonalityAssignmentResult>

  // Enemy type management (F-12)
  async getEnemyTypes(): Promise<EnemyType[]>

  // Internal utility methods
  private async buildPetPrompt(personality: PetPersonality, context: CombatContext, event: CombatEvent): Promise<string>
  private async buildEnemyPrompt(enemyType: EnemyType, playerHistory: PlayerCombatHistory, context: CombatContext, event: CombatEvent): Promise<string>
  private async callAIService(prompt: string, timeout: number): Promise<string>
  private async logChatterEvent(sessionId: string, dialogue: string, metadata: ChatterMetadata): Promise<void>
  private async getRandomFallbackPhrase(phrases: string[]): Promise<string>
}
```

## Method Specifications

### 1. generatePetChatter(sessionId, eventType, eventDetails)

**Purpose**: Generate AI-powered pet dialogue based on personality traits and combat events.

**Authentication**: Required (user-specific combat session)

**Input Parameters**:
- `sessionId: string` - Active combat session identifier
- `eventType: PetChatterEventType` - Combat event trigger
- `eventDetails: CombatEventDetails` - Event context data

**Event Types**:
- `player_attack` - Player executes attack
- `player_defense` - Player takes defensive action
- `enemy_attack` - Enemy attacks player
- `enemy_defense` - Enemy defensive behavior
- `critical_hit` - Critical hit achieved
- `miss` - Attack missed target
- `victory` - Combat victory achieved
- `defeat` - Combat defeat occurred

**Implementation**:
```typescript
async generatePetChatter(sessionId: string, eventType: PetChatterEventType, eventDetails: CombatEventDetails): Promise<ChatterResponse> {
  // 1. Validate session exists and get combat context
  const session = await this.combatRepository.getActiveSession(sessionId);
  if (!session) {
    throw new SessionNotFoundError(`Combat session ${sessionId} not found or expired`);
  }

  // 2. Get equipped pet and personality data
  const pet = await this.petRepository.getEquippedPet(session.userId);
  if (!pet) {
    throw new NoPetEquippedError('Player has no pet equipped for chatter generation');
  }

  const personality = await this.petRepository.getPersonalityData(pet.personality_type);
  if (!personality) {
    throw new PersonalityNotFoundError(`Pet personality ${pet.personality_type} not found`);
  }

  // 3. Build AI prompt with personality context
  const combatContext = {
    turnNumber: eventDetails.turn_number,
    playerHpPct: eventDetails.player_hp_pct,
    enemyHpPct: eventDetails.enemy_hp_pct,
    eventType,
    damage: eventDetails.damage,
    isCritical: eventDetails.is_critical
  };

  const prompt = await this.buildPetPrompt(personality, combatContext, eventDetails);

  // 4. Generate dialogue with timeout and fallback
  let dialogue: string;
  let wasAIGenerated = true;
  const startTime = Date.now();

  try {
    dialogue = await this.callAIService(prompt, 2000); // 2s timeout
  } catch (error) {
    // Fallback to example phrases
    dialogue = await this.getRandomFallbackPhrase(personality.example_phrases);
    wasAIGenerated = false;
  }

  const generationTime = Date.now() - startTime;

  // 5. Log chatter event for analytics
  await this.logChatterEvent(sessionId, dialogue, {
    eventType,
    personalityType: personality.personality_type,
    wasAIGenerated,
    generationTime,
    fallbackReason: !wasAIGenerated ? 'ai_timeout' : null
  });

  return {
    dialogue,
    personality_type: personality.personality_type,
    generation_time_ms: generationTime,
    was_ai_generated: wasAIGenerated
  };
}
```

**Response Contract**:
- `dialogue: string` - Generated pet dialogue (1-2 sentences)
- `personality_type: string` - Pet personality that generated dialogue
- `generation_time_ms: number` - Time taken for generation
- `was_ai_generated: boolean` - Whether AI or fallback was used

**Error Handling**:
- `SessionNotFoundError`: Combat session not found or expired
- `NoPetEquippedError`: Player has no pet equipped
- `PersonalityNotFoundError`: Pet personality template missing
- `ValidationError`: Invalid event type or details

### 2. generateEnemyChatter(sessionId, eventType, eventDetails)

**Purpose**: Generate contextual enemy trash-talk using player combat history and performance.

**Authentication**: Required (user-specific combat session)

**Input Parameters**:
- `sessionId: string` - Active combat session identifier
- `eventType: EnemyChatterEventType` - Combat event trigger
- `eventDetails: CombatEventDetails` - Event context data

**Event Types**:
- `combat_start` - Combat encounter begins
- `player_hit` - Player successfully hits enemy
- `player_miss` - Player misses attack
- `enemy_hit` - Enemy successfully hits player
- `low_player_hp` - Player HP below 25%
- `near_victory` - Enemy HP below 15%
- `defeat` - Enemy defeats player
- `victory` - Player defeats enemy

**Implementation**:
```typescript
async generateEnemyChatter(sessionId: string, eventType: EnemyChatterEventType, eventDetails: CombatEventDetails): Promise<EnemyChatterResponse> {
  // 1. Validate session and get enemy context
  const session = await this.combatRepository.getActiveSession(sessionId);
  if (!session) {
    throw new SessionNotFoundError(`Combat session ${sessionId} not found or expired`);
  }

  const enemyType = await this.enemyRepository.getEnemyType(session.enemyTypeId);
  if (!enemyType) {
    throw new EnemyTypeNotFoundError(`Enemy type ${session.enemyTypeId} not found`);
  }

  // 2. Get player combat history for contextual taunts
  const playerHistory = await this.combatRepository.getPlayerCombatHistory(session.userId, session.locationId);

  // 3. Build AI prompt with enemy personality and player context
  const combatContext = {
    turnNumber: eventDetails.turn_number,
    playerHpPct: eventDetails.player_hp_pct,
    enemyHpPct: eventDetails.enemy_hp_pct,
    eventType,
    damage: eventDetails.damage,
    isCritical: eventDetails.is_critical
  };

  const prompt = await this.buildEnemyPrompt(enemyType, playerHistory, combatContext, eventDetails);

  // 4. Generate dialogue with timeout and fallback
  let dialogue: string;
  let wasAIGenerated = true;
  const startTime = Date.now();

  try {
    dialogue = await this.callAIService(prompt, 2000); // 2s timeout
  } catch (error) {
    // Fallback to example taunts
    dialogue = await this.getRandomFallbackPhrase(enemyType.example_taunts);
    wasAIGenerated = false;
  }

  const generationTime = Date.now() - startTime;

  // 5. Log chatter event for analytics
  await this.logChatterEvent(sessionId, dialogue, {
    eventType,
    enemyType: enemyType.type,
    dialogueTone: enemyType.dialogue_tone,
    wasAIGenerated,
    generationTime,
    playerContextUsed: {
      attempts: playerHistory.attempts,
      victories: playerHistory.victories,
      defeats: playerHistory.defeats,
      currentStreak: playerHistory.current_streak
    },
    fallbackReason: !wasAIGenerated ? 'ai_timeout' : null
  });

  return {
    dialogue,
    enemy_type: enemyType.type,
    dialogue_tone: enemyType.dialogue_tone,
    generation_time_ms: generationTime,
    was_ai_generated: wasAIGenerated,
    player_context_used: {
      attempts: playerHistory.attempts,
      victories: playerHistory.victories,
      defeats: playerHistory.defeats,
      current_streak: playerHistory.current_streak
    }
  };
}
```

**Response Contract**:
- `dialogue: string` - Generated enemy taunt (1-2 sentences)
- `enemy_type: string` - Enemy type that generated dialogue
- `dialogue_tone: string` - Tone used (aggressive, sarcastic, etc.)
- `generation_time_ms: number` - Time taken for generation
- `was_ai_generated: boolean` - Whether AI or fallback was used
- `player_context_used: object` - Player history context included in generation

### 3. getPetPersonalities()

**Purpose**: Return available pet personality types with example phrases and traits.

**Authentication**: None required (public reference data)

**Implementation**:
```typescript
async getPetPersonalities(): Promise<PetPersonality[]> {
  return await this.petRepository.getAllPersonalities();
}
```

**Response Contract**:
- Returns array of PetPersonality objects
- Includes: personality_type, display_name, description, traits, example_phrases, verbosity
- Ordered by display_name alphabetically

### 4. assignPetPersonality(petId, personalityType, customName?)

**Purpose**: Assign personality type and optional custom name to player's pet.

**Authentication**: Required (user owns pet)

**Input Parameters**:
- `petId: string` - Pet identifier to update
- `personalityType: string` - Personality type to assign
- `customName?: string` - Optional custom pet name

**Implementation**:
```typescript
async assignPetPersonality(petId: string, personalityType: string, customName?: string): Promise<PersonalityAssignmentResult> {
  // 1. Validate pet ownership and personality type exists
  const pet = await this.petRepository.findPetById(petId);
  if (!pet) {
    throw new PetNotFoundError(`Pet ${petId} not found`);
  }

  const personality = await this.petRepository.getPersonalityData(personalityType);
  if (!personality) {
    throw new InvalidPersonalityError(`Personality type ${personalityType} not found`);
  }

  // 2. Update pet with new personality and optional name
  await this.petRepository.updatePetPersonality(petId, personalityType, customName);

  return {
    success: true,
    pet_id: petId,
    personality_type: personalityType,
    custom_name: customName
  };
}
```

### 5. getEnemyTypes()

**Purpose**: Return available enemy types with personality traits and example taunts.

**Authentication**: None required (public reference data)

**Implementation**:
```typescript
async getEnemyTypes(): Promise<EnemyType[]> {
  return await this.enemyRepository.getAllEnemyTypes();
}
```

## Repository Dependencies

### CombatRepository

**Required Methods**:
- `getActiveSession(sessionId: string): Promise<CombatSession | null>`
- `getPlayerCombatHistory(userId: string, locationId: string): Promise<PlayerCombatHistory>`

**Integration**: Provides combat session context and player performance history for contextual chatter generation.

### PetRepository

**Required Methods**:
- `getEquippedPet(userId: string): Promise<EquippedPet | null>`
- `getPersonalityData(personalityType: string): Promise<PetPersonality | null>`
- `getAllPersonalities(): Promise<PetPersonality[]>`
- `findPetById(petId: string): Promise<Pet | null>`
- `updatePetPersonality(petId: string, personalityType: string, customName?: string): Promise<void>`

**Integration**: Manages pet personality data and equipped pet information for chatter generation.

### EnemyRepository

**Required Methods**:
- `getEnemyType(enemyTypeId: string): Promise<EnemyType | null>`
- `getAllEnemyTypes(): Promise<EnemyType[]>`

**Integration**: Provides enemy personality traits and dialogue templates for trash-talk generation.

### AnalyticsRepository

**Required Methods**:
- `logChatterEvent(sessionId: string, dialogue: string, metadata: ChatterMetadata): Promise<void>`

**Integration**: Records all generated dialogue with metadata for quality analysis and service optimization.

## AI Service Integration

### OpenAI GPT-4.1-nano Configuration

**Model**: `gpt-4.1-nano`
**Timeout**: 2000ms (2 seconds)
**Max Tokens**: 100 (for 1-2 sentence responses)
**Temperature**: 0.8 (creative but consistent)

### Prompt Engineering

#### Pet Chatter Prompt Template
```
You are a {personality_type} pet companion in a fantasy combat game. Your traits: {traits}.

Combat Context:
- Turn {turn_number}, Player HP: {player_hp_pct}%, Enemy HP: {enemy_hp_pct}%
- Event: {event_type}
- {event_specific_context}

Generate a single, short {verbosity} comment (1-2 sentences) that matches your {personality_type} personality. Stay in character and react to the combat event.

Personality Guidelines:
- sassy: Witty, slightly sarcastic, confident
- encouraging: Supportive, motivational, optimistic
- analytical: Data-focused, strategic, logical
- chaotic: Unpredictable, energetic, random
- stoic: Calm, philosophical, reserved
- trash_talker: Competitive, provocative, boastful

Response:
```

#### Enemy Chatter Prompt Template
```
You are a {enemy_type} enemy with {dialogue_tone} personality in a fantasy combat game.

Player History at this location:
- Attempts: {attempts}, Victories: {victories}, Defeats: {defeats}
- Current streak: {current_streak} ({streak_type})
- Win rate: {win_rate}%

Combat Context:
- Turn {turn_number}, Player HP: {player_hp_pct}%, Your HP: {enemy_hp_pct}%
- Event: {event_type}
- {event_specific_context}

Generate a single, short taunt (1-2 sentences) that:
1. Matches your {dialogue_tone} personality
2. References the player's performance history when relevant
3. Reacts to the current combat event

Tone Guidelines:
- aggressive: Direct threats, intimidating
- sarcastic: Mocking, ironic, cutting
- condescending: Patronizing, superior, dismissive
- chaotic: Unpredictable, nonsensical, erratic
- political: References current events, philosophical

Response:
```

### Error Handling & Fallbacks

**Timeout Strategy**: 2-second hard timeout with immediate fallback to seed phrases
**Rate Limiting**: Max 1 chatter request per turn per session
**Service Degradation**: Use cached responses when API unavailable
**Quality Control**: Log generation success/failure rates for monitoring

## API Endpoints

### ChatterController

#### POST /api/v1/combat/pet-chatter

**Description**: Generate AI-powered pet dialogue for combat events (F-11)

**Input Schema**: `PetChatterSchema`
```typescript
{
  session_id: string;
  event_type: 'player_attack' | 'player_defense' | 'enemy_attack' | 'enemy_defense' | 'critical_hit' | 'miss' | 'victory' | 'defeat';
  event_details: {
    damage?: number;
    accuracy?: number;
    is_critical?: boolean;
    turn_number: number;
    player_hp_pct: number;
    enemy_hp_pct: number;
  };
}
```

**Output Schema**: `ChatterResponseSchema`
```typescript
{
  dialogue: string;
  personality_type: string;
  generation_time_ms: number;
  was_ai_generated: boolean;
}
```

**Errors**:
- 400: Invalid event_type or event_details
- 404: Combat session not found or no pet equipped
- 503: AI service unavailable (returns fallback phrase)

#### POST /api/v1/combat/enemy-chatter

**Description**: Generate AI-powered enemy trash-talk for combat events (F-12)

**Input Schema**: `EnemyChatterSchema`
```typescript
{
  session_id: string;
  event_type: 'combat_start' | 'player_hit' | 'player_miss' | 'enemy_hit' | 'low_player_hp' | 'near_victory' | 'defeat' | 'victory';
  event_details: {
    damage?: number;
    accuracy?: number;
    is_critical?: boolean;
    turn_number: number;
    player_hp_pct: number;
    enemy_hp_pct: number;
  };
}
```

**Output Schema**: `EnemyChatterResponseSchema`
```typescript
{
  dialogue: string;
  enemy_type: string;
  dialogue_tone: 'aggressive' | 'sarcastic' | 'condescending' | 'chaotic' | 'political';
  generation_time_ms: number;
  was_ai_generated: boolean;
  player_context_used: {
    attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
  };
}
```

**Errors**:
- 400: Invalid event_type or event_details
- 404: Combat session not found or expired
- 503: AI service unavailable (returns fallback taunt)

#### GET /api/v1/pets/personalities

**Description**: Get available pet personality types (F-11)

**Output Schema**: `PetPersonalitiesSchema`
```typescript
{
  personalities: Array<{
    personality_type: string;
    display_name: string;
    description: string;
    traits: string[];
    example_phrases: string[];
    verbosity: 'terse' | 'moderate' | 'verbose';
  }>;
}
```

#### PUT /api/v1/pets/{pet_id}/personality

**Description**: Assign personality to player's pet (F-11)

**Input Schema**: `AssignPersonalitySchema`
```typescript
{
  personality_type: 'sassy' | 'encouraging' | 'analytical' | 'chaotic' | 'stoic' | 'trash_talker';
  custom_name?: string;
}
```

**Output Schema**: `PersonalityAssignmentSchema`
```typescript
{
  success: boolean;
  pet_id: string;
  personality_type: string;
  custom_name?: string;
}
```

**Errors**:
- 400: Invalid personality_type
- 404: Pet not found or not owned by player

#### GET /api/v1/enemies/types

**Description**: Get available enemy types with personality traits (F-12)

**Output Schema**: `EnemyTypesSchema`
```typescript
{
  enemy_types: Array<{
    type: string;
    display_name: string;
    personality_traits: string[];
    dialogue_tone: string;
    verbosity: string;
    example_taunts: string[];
    tier_id: number;
    style_id: string;
  }>;
}
```

## Integration Points

### CombatService Integration

**Called During Combat Events**:
- After player attack: Generate pet encouragement/commentary
- Before enemy attack: Generate enemy taunt
- On critical hit: Generate excited pet dialogue
- On miss: Generate pet consolation or enemy mockery
- On victory/defeat: Generate appropriate conclusion dialogue

**Integration Pattern**:
```typescript
// In CombatService.executeAttack()
const attackResult = await this.calculateAttackDamage(sessionId, tapPositionDegrees);

// Generate pet chatter for player's attack
const petChatter = await this.chatterService.generatePetChatter(sessionId, 'player_attack', {
  turn_number: attackResult.turn_number,
  player_hp_pct: attackResult.player_hp_remaining / session.playerStats.hp,
  enemy_hp_pct: attackResult.enemy_hp_remaining / session.enemyStats.hp,
  damage: attackResult.damage_dealt,
  is_critical: attackResult.hit_zone === 'crit'
});

// Generate enemy counter-taunt
const enemyChatter = await this.chatterService.generateEnemyChatter(sessionId, 'player_hit', {
  turn_number: attackResult.turn_number,
  player_hp_pct: attackResult.player_hp_remaining / session.playerStats.hp,
  enemy_hp_pct: attackResult.enemy_hp_remaining / session.enemyStats.hp,
  damage: attackResult.damage_dealt
});

return {
  ...attackResult,
  pet_chatter: petChatter,
  enemy_chatter: enemyChatter
};
```

### Analytics Integration

**Logged Metrics**:
- Chatter generation success/failure rates
- AI service response times and timeout frequencies
- Personality type usage distribution
- Player engagement with chatter (future: reaction tracking)
- Dialog quality feedback (future: player rating system)

## Performance Considerations

### AI Service Optimization

**Caching Strategy**:
- Cache generated dialogue for identical context (1 hour TTL)
- Pre-generate common scenarios during low-traffic periods
- Batch multiple chatter requests when possible

**Timeout Management**:
- Hard 2-second timeout prevents combat flow blocking
- Immediate fallback to seed phrases maintains user experience
- Circuit breaker pattern for consecutive AI failures

**Rate Limiting**:
- Max 1 chatter generation per combat turn
- Queue overflow prevention during high-traffic periods
- Priority system: critical events > routine commentary

### Database Performance

**Query Optimization**:
- Index on pet_personalities.personality_type for fast lookups
- Cache personality and enemy type data in memory
- Prepared statements for chatter logging

**Analytics Storage**:
- Asynchronous logging to prevent combat latency
- Batched inserts for high-volume chatter events
- Partitioned tables for long-term analytics storage

## Error Handling

### Service-Level Errors

**AIServiceTimeoutError**: OpenAI API timeout (>2s)
- **Recovery**: Use fallback phrases from seed data
- **Logging**: Record timeout frequency for monitoring
- **User Impact**: Transparent (user sees fallback dialogue)

**NoPetEquippedError**: Player has no pet for chatter generation
- **Recovery**: Skip pet chatter generation
- **Logging**: Track pet equipment rates
- **User Impact**: No pet dialogue, enemy chatter continues

**PersonalityNotFoundError**: Pet personality template missing
- **Recovery**: Use default "encouraging" personality
- **Logging**: Alert for missing personality data
- **User Impact**: Generic personality responses

**SessionExpiredError**: Combat session no longer valid
- **Recovery**: Graceful failure, return appropriate error
- **Logging**: Track session expiry patterns
- **User Impact**: Clear error message, redirect to main game

### Graceful Degradation

**AI Service Unavailable**:
- Immediate fallback to seed phrase library
- Maintain combat flow without delays
- Background service health monitoring

**Database Connection Issues**:
- Cache personality data in memory
- Queue analytics logging for retry
- Continue combat with cached data

**High Load Scenarios**:
- Circuit breaker for AI service calls
- Fallback-only mode during peak traffic
- Prioritize core combat over chatter generation

## Testing Strategy

### Unit Tests

**ChatterService Methods**:
- Mock all repository dependencies
- Test prompt generation logic
- Validate fallback phrase selection
- Test timeout handling and error recovery

**Prompt Engineering**:
- Test prompt template generation
- Validate context data injection
- Test edge cases (zero HP, high turn numbers)

**Analytics Integration**:
- Mock analytics repository
- Test metadata collection accuracy
- Validate logging frequency and data structure

### Integration Tests

**Full Chatter Flow**:
- Real database with test combat sessions
- Mock OpenAI API with controlled responses
- Test chatter generation in complete combat scenarios

**AI Service Integration**:
- Test actual OpenAI API calls with test prompts
- Validate response parsing and error handling
- Test timeout behavior under load

**Cross-Service Integration**:
- Test CombatService + ChatterService integration
- Validate chatter timing during combat flow
- Test session sharing and data consistency

### Load Tests

**High-Frequency Chatter**:
- 100+ simultaneous combat sessions with active chatter
- Test AI service rate limiting and circuit breaker
- Validate fallback system under AI service overload

**Analytics Throughput**:
- High-volume chatter logging stress test
- Test asynchronous logging performance
- Validate analytics data consistency under load

## Implementation Priority

### Phase 1: Core Pet Chatter (F-11)
1. **PetRepository**: Personality data management and equipped pet lookup
2. **ChatterService**: Pet dialogue generation with AI integration
3. **Pet API endpoints**: Personality assignment and listing
4. **Basic fallback system**: Seed phrase selection when AI unavailable

### Phase 2: Enemy Trash Talk (F-12)
1. **EnemyRepository**: Enhanced with personality trait management
2. **ChatterService**: Enemy dialogue with player history integration
3. **Combat history integration**: Player performance context for taunts
4. **Enemy API endpoints**: Type listings and trait management

### Phase 3: CombatService Integration
1. **Combat flow integration**: Add chatter generation to attack/defense cycles
2. **Event-driven chatter**: Trigger appropriate dialogue based on combat events
3. **Response aggregation**: Include chatter in combat result payloads

### Phase 4: Analytics & Optimization
1. **Analytics implementation**: Comprehensive chatter logging and metrics
2. **Performance optimization**: Caching, circuit breakers, batch processing
3. **Quality monitoring**: Success rates, timeout tracking, user engagement
4. **Advanced features**: Contextual phrase learning, dynamic personality adjustment

## Dependencies

### External Services
- **OpenAI API**: GPT-4.1-nano for dialogue generation (~$0.0001-$0.0005/request)
- **Redis**: Optional caching for generated dialogue (1 hour TTL)

### Internal Dependencies
- **CombatService**: Combat session management and event context
- **AuthService**: User authentication and session validation
- **PetService**: Pet ownership and equipment validation

### Development Dependencies
- **Jest**: Unit and integration testing framework
- **Supertest**: API endpoint testing
- **OpenAI Mock**: AI service testing with controlled responses
- **Supabase Test Client**: Database testing with rollback support

## Data Models

### Database Tables

**pet_personalities**:
```sql
CREATE TABLE pet_personalities (
  personality_type VARCHAR(50) PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  traits TEXT[] NOT NULL,
  example_phrases TEXT[] NOT NULL,
  verbosity VARCHAR(20) NOT NULL CHECK (verbosity IN ('terse', 'moderate', 'verbose'))
);
```

**enemy_types** (extended):
```sql
ALTER TABLE enemy_types ADD COLUMN personality_traits TEXT[];
ALTER TABLE enemy_types ADD COLUMN dialogue_tone VARCHAR(50);
ALTER TABLE enemy_types ADD COLUMN example_taunts TEXT[];
ALTER TABLE enemy_types ADD COLUMN verbosity VARCHAR(20);
```

**combat_chatter_log**:
```sql
CREATE TABLE combat_chatter_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  chatter_type VARCHAR(20) NOT NULL CHECK (chatter_type IN ('pet', 'enemy')),
  event_type VARCHAR(50) NOT NULL,
  dialogue TEXT NOT NULL,
  was_ai_generated BOOLEAN NOT NULL DEFAULT false,
  generation_time_ms INTEGER NOT NULL,
  personality_type VARCHAR(50),
  dialogue_tone VARCHAR(50),
  fallback_reason VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### TypeScript Types

```typescript
export interface PetPersonality {
  personality_type: string;
  display_name: string;
  description: string;
  traits: string[];
  example_phrases: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
}

export interface EnemyType {
  type: string;
  display_name: string;
  personality_traits: string[];
  dialogue_tone: 'aggressive' | 'sarcastic' | 'condescending' | 'chaotic' | 'political';
  example_taunts: string[];
  verbosity: 'terse' | 'moderate' | 'verbose';
  tier_id: number;
  style_id: string;
}

export interface CombatEventDetails {
  damage?: number;
  accuracy?: number;
  is_critical?: boolean;
  turn_number: number;
  player_hp_pct: number;
  enemy_hp_pct: number;
}

export interface ChatterResponse {
  dialogue: string;
  personality_type: string;
  generation_time_ms: number;
  was_ai_generated: boolean;
}

export interface EnemyChatterResponse extends ChatterResponse {
  enemy_type: string;
  dialogue_tone: string;
  player_context_used: {
    attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
  };
}

export interface ChatterMetadata {
  eventType: string;
  personalityType?: string;
  enemyType?: string;
  dialogueTone?: string;
  wasAIGenerated: boolean;
  generationTime: number;
  playerContextUsed?: PlayerCombatHistory;
  fallbackReason?: string;
}
```

## See Also

### Related Service Specifications
- **[CombatService](./combat-service-spec.md)** - Primary integration point for chatter generation during combat
- **[PetService](./pet-service-spec.md)** - Pet ownership and equipment management
- **[AnalyticsService](./analytics-service-spec.md)** - Chatter logging and performance monitoring

### Cross-Referenced Features
- **F-11**: Pet Personality & Chatter (primary feature)
- **F-12**: Enemy Trash Talk (primary feature)
- **F-02**: Combat System (integration point)
- **F-06**: Pet System (pet ownership and equipment)