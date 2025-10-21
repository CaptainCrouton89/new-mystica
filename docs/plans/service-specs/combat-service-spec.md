# Combat Service Specification

**Version**: 1.0
**Date**: 2025-01-27
**Status**: Draft

## Overview

This document specifies the implementation requirements for the Combat system backend services, covering combat session management, pet and enemy AI chatter generation, and combat flow orchestration. The system implements turn-based combat with weapon-specific timing dial mechanics and Redis-based session management.

## Architecture Components

### Core Services
- **CombatService**: Combat session management, damage calculation, flow orchestration
- **ChatterService**: AI-powered dialogue generation for pets (F-11) and enemies (F-12)
- **PetController**: Pet personality assignment and management
- **EnemyController**: Enemy types, pools, and combat history
- **CombatController**: Combat flow endpoints and session handling

### Data Storage
- **PostgreSQL**: Persistent combat history, enemy types, pet personalities, pool configurations
- **Redis**: Active combat sessions (15min TTL) with real-time state management
- **AI Services**: OpenAI GPT-4.1-nano for dynamic dialogue generation

## API Endpoints

### CombatController

#### POST /api/v1/combat/start
**Description**: Initialize new combat encounter at location
**Input Schema**: `StartCombatSchema`
```typescript
{
  location_id: string; // UUID
}
```
**Output Schema**: `CombatSessionSchema`
```typescript
{
  session_id: string;
  enemy: {
    id: string;
    type: string;
    name: string;
    atk: number;
    def: number;
    hp: number;
    style_id: string;
    dialogue_tone: string;
    personality_traits: string[];
  };
  player_stats: {
    atkPower: number;
    atkAccuracy: number;
    defPower: number;
    defAccuracy: number;
    hp: number;
  };
  weapon_config: {
    pattern: 'single_arc' | 'dual_arcs' | 'pulsing_arc' | 'roulette' | 'sawtooth';
    spin_deg_per_s: number;
    adjusted_bands: {
      deg_injure: number;
      deg_miss: number;
      deg_graze: number;
      deg_normal: number;
      deg_crit: number;
    };
  };
}
```
**Errors**:
- 404: Location not found or no enemy at location
- 409: User already has active combat session
- 401: Unauthorized

#### POST /api/v1/combat/attack
**Description**: Execute player attack with timing dial mechanics
**Input Schema**: `AttackSchema`
```typescript
{
  session_id: string;
  tap_position_degrees: number; // 0-360
}
```
**Output Schema**: `AttackResultSchema`
```typescript
{
  hit_zone: 'injure' | 'miss' | 'graze' | 'normal' | 'crit';
  base_multiplier: number;
  crit_bonus_multiplier?: number; // 0-1.0, only if crit
  damage_dealt: number;
  player_hp_remaining: number;
  enemy_hp_remaining: number;
  enemy_damage: number; // Counterattack damage
  combat_status: 'ongoing' | 'victory' | 'defeat';
  turn_number: number;
}
```
**Errors**:
- 404: Session not found or expired
- 400: Invalid tap_position_degrees

#### POST /api/v1/combat/complete
**Description**: Complete combat and distribute rewards
**Input Schema**: `CompleteCombatSchema`
```typescript
{
  session_id: string;
  result: 'victory' | 'defeat';
}
```
**Output Schema**: `CombatRewardsSchema`
```typescript
{
  result: 'victory' | 'defeat';
  rewards?: {
    materials: Array<{
      material_id: string;
      name: string;
      style_id: string;
      style_name: string;
    }>;
    gold: number;
    experience: number;
  };
  player_combat_history: {
    location_id: string;
    total_attempts: number;
    victories: number;
    defeats: number;
    current_streak: number;
    longest_streak: number;
  };
}
```
**Errors**:
- 404: Session not found
- 400: Invalid result value

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
- 400: Invalid event_type
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
- 400: Invalid event_type
- 404: Combat session not found or expired
- 503: AI service unavailable (returns fallback taunt)

### PetController

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

### EnemyController

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

#### GET /api/v1/players/combat-history/{location_id}
**Description**: Get player's combat history at specific location (F-12)
**Output Schema**: `PlayerCombatHistorySchema`
```typescript
{
  location_id: string;
  attempts: number;
  victories: number;
  defeats: number;
  win_rate: number;
  current_streak: number;
  longest_streak: number;
  last_attempt?: string; // ISO timestamp
}
```
**Errors**:
- 404: Location not found (returns zeroed stats if never attempted)

## Service Layer Specifications

### CombatService

#### Repository Dependencies
- `CombatRepository`: Session management, combat history, log events
- `EnemyRepository`: Enemy types, pools, stat calculations
- `LocationRepository`: Location validation and enemy pool matching
- `EquipmentRepository`: Player equipment and stat calculations
- `WeaponRepository`: Weapon timing configurations
- `MaterialRepository`: Loot generation and style inheritance

#### Key Methods

**startCombat(userId: string, locationId: string): Promise<CombatSession>**
- Validate user has no active session
- Get location and apply pool filtering logic
- Select enemy from matching pools using weighted random
- Calculate player stats via `v_player_equipped_stats` view
- Calculate enemy stats via `v_enemy_realized_stats` view
- Get weapon configuration and apply accuracy adjustments via `fn_weapon_bands_adjusted()`
- Create session in PostgreSQL with 15min expiry logic
- Return session data with adjusted weapon bands

**executeAttack(sessionId: string, tapPositionDegrees: number): Promise<AttackResult>**
- Validate session exists and not expired
- Determine hit zone using adjusted weapon bands
- Apply zone multipliers: injure=-50%, miss=0%, graze=60%, normal=100%, crit=160%+RNG
- Calculate damage: `(player_ATK * multiplier) - enemy_DEF` (min 1)
- Handle injure zone (player takes damage instead)
- Apply enemy counterattack: `enemy_ATK - player_DEF` (min 1)
- Update session state and log event
- Check win/loss conditions
- Return attack result with updated HP values

**completeCombat(sessionId: string, result: CombatResult): Promise<CombatRewards>**
- Validate session exists
- Generate loot from applied loot pools (victory only)
- Apply style inheritance from enemy to materials
- Award gold and experience
- Update player combat history via `update_combat_history` RPC
- Mark session as completed
- Return rewards and updated history

**Private Methods:**
- `calculateDamage(attackerAtk: number, defenderDef: number, multiplier: number): number`
- `determineHitZone(tapDegrees: number, adjustedBands: WeaponBands): HitZone`
- `generateCritBonus(): number` // 0-100% bonus
- `applyPoolFilters(location: Location, combatLevel: number): Promise<{enemyPools: string[], lootPools: string[]}>`

### ChatterService

#### Repository Dependencies
- `CombatRepository`: Session context and event tracking
- `PetRepository`: Pet personality data and custom names
- `EnemyRepository`: Enemy personality traits and dialogue templates
- `AnalyticsRepository`: Chatter log storage for analytics

#### Key Methods

**generatePetChatter(sessionId: string, eventType: string, eventDetails: any): Promise<ChatterResponse>**
- Get session context from Redis/PostgreSQL
- Get equipped pet and personality data
- Construct AI prompt with personality traits and base dialogue style
- Add combat context (turn number, HP percentages, event details)
- Call OpenAI API with 2s timeout
- Log dialogue to `combat_chatter_log` table
- Return dialogue with generation metadata
- Fallback to `example_phrases` on AI failure

**generateEnemyChatter(sessionId: string, eventType: string, eventDetails: any): Promise<EnemyChatterResponse>**
- Get session context and enemy type
- Get player combat history at location
- Construct AI prompt with enemy personality traits and dialogue tone
- Add player performance context (attempts, win rate, current streak)
- Add combat context (turn number, HP, damage, event type)
- Call OpenAI API with 2s timeout
- Log dialogue to `enemy_chatter_log` table
- Return dialogue with tone and player context
- Fallback to `example_taunts` on AI failure

**Private Methods:**
- `buildPetPrompt(personality: PetPersonality, context: CombatContext, event: CombatEvent): string`
- `buildEnemyPrompt(enemyType: EnemyType, playerHistory: PlayerCombatHistory, context: CombatContext, event: CombatEvent): string`
- `callAIService(prompt: string, timeout: number): Promise<string>`
- `logChatterEvent(sessionId: string, dialogue: string, metadata: any): Promise<void>`

### Integration Points

#### Redis Session Management
- **Key Pattern**: `combat:session:{sessionId}`
- **TTL**: 900 seconds (15 minutes)
- **Data Structure**:
```typescript
{
  id: string;
  userId: string;
  locationId: string;
  enemyTypeId: string;
  playerStats: PlayerStats;
  enemyStats: EnemyStats;
  weaponConfig: WeaponConfig;
  currentHP: { player: number; enemy: number };
  turnNumber: number;
  createdAt: string;
  lastActivity: string;
}
```

#### Database Functions (PostgreSQL)
- `fn_weapon_bands_adjusted(weapon_id, player_accuracy)`: Returns accuracy-adjusted hit bands
- `fn_expected_mul_quick(weapon_id, player_accuracy)`: Expected damage multiplier
- `combat_rating(atk, def, hp)`: Elo-style combat power calculation
- `effective_hp(hp, defense)`: Survivability with diminishing returns
- `update_combat_history(user_id, location_id, result)`: Atomic history update

#### Pool System Logic
- **Enemy Selection**: Query `EnemyPools` WHERE `combat_level = player_avg_level` AND filter matches location
- **Filter Types**: universal, location_type, state, country, lat_range, lng_range
- **Weighted Random**: Aggregate `spawn_weight` across matching pools, select by weight
- **Loot Generation**: Apply same pool logic to `LootPools` for material drops
- **Style Inheritance**: Enemy `style_id` != 'normal' → all material drops inherit that style

#### Combat Balance Functions
- **Hit Zone Multipliers**: injure=-0.5, miss=0.0, graze=0.6, normal=1.0, crit=1.6+RNG(0-1.0)
- **Damage Formula**: `MAX(1, (ATK * multiplier) - DEF)`
- **Accuracy Scaling**: Higher accuracy shrinks miss/injure zones, expands crit zones
- **Crit Bonus**: Random 0-100% additional multiplier on crit hits

## Zod Validation Schemas

```typescript
// Combat Schemas
export const StartCombatSchema = z.object({
  location_id: z.string().uuid(),
});

export const AttackSchema = z.object({
  session_id: z.string().uuid(),
  tap_position_degrees: z.number().min(0).max(360),
});

export const CompleteCombatSchema = z.object({
  session_id: z.string().uuid(),
  result: z.enum(['victory', 'defeat']),
});

// Chatter Schemas
export const PetChatterSchema = z.object({
  session_id: z.string().uuid(),
  event_type: z.enum(['player_attack', 'player_defense', 'enemy_attack', 'enemy_defense', 'critical_hit', 'miss', 'victory', 'defeat']),
  event_details: z.object({
    damage: z.number().optional(),
    accuracy: z.number().min(0).max(1).optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().min(1),
    player_hp_pct: z.number().min(0).max(1),
    enemy_hp_pct: z.number().min(0).max(1),
  }),
});

export const EnemyChatterSchema = z.object({
  session_id: z.string().uuid(),
  event_type: z.enum(['combat_start', 'player_hit', 'player_miss', 'enemy_hit', 'low_player_hp', 'near_victory', 'defeat', 'victory']),
  event_details: z.object({
    damage: z.number().optional(),
    accuracy: z.number().min(0).max(1).optional(),
    is_critical: z.boolean().optional(),
    turn_number: z.number().int().min(1),
    player_hp_pct: z.number().min(0).max(1),
    enemy_hp_pct: z.number().min(0).max(1),
  }),
});

// Pet Schemas
export const AssignPersonalitySchema = z.object({
  personality_type: z.enum(['sassy', 'encouraging', 'analytical', 'chaotic', 'stoic', 'trash_talker']),
  custom_name: z.string().max(50).optional(),
});

// Common Types
export const HitZoneSchema = z.enum(['injure', 'miss', 'graze', 'normal', 'crit']);
export const CombatStatusSchema = z.enum(['ongoing', 'victory', 'defeat']);
export const DialogueToneSchema = z.enum(['aggressive', 'sarcastic', 'condescending', 'chaotic', 'political']);
export const VerbositySchema = z.enum(['terse', 'moderate', 'verbose']);
```

## Error Handling

### Combat Service Errors
- **SessionExpiredError**: Combat session has exceeded 15min TTL
- **InvalidMoveError**: Tap position outside valid range
- **ConcurrentSessionError**: User already has active session
- **EnemyPoolEmptyError**: No enemies available for location/level
- **WeaponNotEquippedError**: Player has no weapon equipped

### Chatter Service Errors
- **AIServiceTimeoutError**: OpenAI API timeout (>2s), use fallback phrases
- **NoPetEquippedError**: Player has no pet for chatter generation
- **PersonalityNotFoundError**: Pet personality template missing
- **RateLimitError**: AI service rate limited, use cached phrases

### Recovery Strategies
- **Session Expiry**: Auto-cleanup via scheduled job, treat as combat abandoned
- **AI Failures**: Always provide fallback dialogue from seed data
- **Pool Failures**: Fall back to universal pools if location-specific pools empty
- **Weapon Failures**: Use default weapon configuration with single_arc pattern

## Performance Considerations

### Redis Session Optimization
- **Pipelining**: Batch session reads/writes within single request
- **Compression**: Gzip session data if >1KB
- **Expiry Extension**: Update `lastActivity` on each action to prevent premature expiry
- **Cleanup Job**: Scheduled task every 5 minutes to mark expired sessions as abandoned

### Database Query Optimization
- **Prepared Statements**: Use parameterized queries for combat calculations
- **View Caching**: `v_enemy_realized_stats` and `v_player_equipped_stats` are computed on-read
- **Pool Queries**: Index on `(combat_level, filter_type)` for fast pool matching
- **History Updates**: Use atomic RPC functions to prevent race conditions

### AI Service Integration
- **Timeout Handling**: 2s timeout for chatter generation, immediate fallback
- **Caching**: Cache generated dialogue for 1 hour to reduce API calls
- **Rate Limiting**: Max 1 chatter request per turn per session
- **Graceful Degradation**: Always provide fallback phrases from seed data

## Testing Strategy

### Unit Tests
- **CombatService**: Mock all repository dependencies, test combat math
- **ChatterService**: Mock AI service, test prompt generation and fallbacks
- **Hit Zone Logic**: Test `determineHitZone()` with all accuracy levels
- **Damage Calculation**: Test multiplier application and min damage

### Integration Tests
- **Full Combat Flow**: Start → attack → chatter → complete with real database
- **Pool Selection**: Test weighted random selection across multiple pools
- **Session Expiry**: Test automatic cleanup and expiry handling
- **AI Failover**: Test fallback to example phrases on service failure

### Load Tests
- **Concurrent Sessions**: 100+ simultaneous combat sessions
- **Chatter Generation**: High-frequency chatter requests with AI service
- **Redis Performance**: Session creation/updates under load
- **Database Stress**: Pool queries and history updates at scale

## Implementation Priority

### Phase 1: Core Combat (F-02)
1. **CombatRepository**: Session management, history tracking, log events
2. **CombatService**: Basic combat flow without chatter
3. **CombatController**: Start, attack, complete endpoints
4. **Pool System**: Enemy and loot pool selection logic

### Phase 2: Pet Chatter (F-11)
1. **PetRepository**: Personality management and validation
2. **ChatterService**: Pet dialogue generation with AI integration
3. **Pet endpoints**: Personality assignment and listing

### Phase 3: Enemy Chatter (F-12)
1. **EnemyRepository**: Enhanced with personality data handling
2. **ChatterService**: Enemy dialogue with player history context
3. **Enemy endpoints**: Type listings and combat history

### Phase 4: Polish & Performance
1. **Redis optimization**: Session compression and pipelining
2. **AI caching**: Reduce API calls with intelligent caching
3. **Comprehensive testing**: Load testing and failover scenarios
4. **Analytics**: Enhanced logging and performance monitoring

## Dependencies

### External Services
- **OpenAI API**: GPT-4.1-nano for dialogue generation (~$0.0001/request)
- **Redis**: Session storage with TTL management
- **PostgreSQL**: Persistent data with computed views and functions

### Internal Dependencies
- **AuthService**: User authentication and session validation
- **LocationService**: Location validation and proximity checking
- **EquipmentService**: Player stat calculation and weapon configuration
- **MaterialService**: Loot generation and style inheritance

### Development Dependencies
- **Jest**: Unit and integration testing framework
- **Supertest**: API endpoint testing
- **Redis Mock**: In-memory Redis for testing
- **Supabase Test Client**: Database testing with rollback support

## See Also

### Related Service Specifications
- **[ChatterService](./chatter-service-spec.md)** - AI dialogue generation for pets (F-11) and enemies (F-12)
- **[LocationService](./location-service-spec.md)** - Location validation, enemy pool matching, loot pool selection
- **[EquipmentService](./equipment-service-spec.md)** - Player stat calculations for combat initialization
- **[MaterialService](./material-service-spec.md)** - Loot generation with style inheritance from defeated enemies

### Cross-Referenced Features
- **F-02**: Combat System (primary feature)
- **F-11**: Pet Personality & Chatter (ChatterService dependency)
- **F-12**: Enemy Trash Talk (ChatterService dependency)
- **F-01**: Geolocation & Spawning (LocationService integration)
- **F-03**: Equipment System (EquipmentService integration)
- **F-04**: Materials System (loot drops with style inheritance)